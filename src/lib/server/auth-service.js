import { ObjectId } from 'mongodb';
import { hashPassword, verifyPassword, createToken, hashToken } from './auth-crypto.js';
import { normalizeEmail, validateRegistration } from '../auth-rules.js';
import { createLoginLimiter } from './login-limiter.js';

export const SESSION_SECONDS = 30 * 24 * 60 * 60;
export class RegistrationError extends Error {
	constructor(errors) { super('Bitte prüfe deine Angaben.'); this.errors = errors; }
}
export function createAuthService(getDb, now = Date.now) {
	const limiter = createLoginLimiter(now);
	let indexes;
	let dummyHash;
	const pendingLogins = new Set();
	async function authDb() {
		const db = await getDb();
		indexes ??= Promise.all([
			db.collection('users').createIndex({ email: 1 }, { unique: true }),
			db.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true }),
			db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
		]);
		try { await indexes; } catch (error) { indexes = undefined; throw error; }
		return db;
	}
	const userView = (user) => ({ id: user._id.toHexString(), name: user.name, email: user.email });

	async function createSession(db, user) {
		const token = createToken();
		const createdAt = new Date(now());
		const expiresAt = new Date(createdAt.getTime() + SESSION_SECONDS * 1000);
		await db.collection('sessions').insertOne({ tokenHash: hashToken(token), userId: user._id, createdAt, expiresAt });
		return { token, expiresAt, user: userView(user) };
	}

	async function register(input) {
		const result = validateRegistration(input);
		if (!result.valid) throw new RegistrationError(result.errors);
		const passwordHash = await hashPassword(input.password);
		const db = await authDb();
		const user = { _id: new ObjectId(), ...result.values, passwordHash, createdAt: new Date(now()) };
		try { await db.collection('users').insertOne(user); }
		catch (error) {
			if (error.code === 11000) throw new RegistrationError({ email: 'Für diese E-Mail-Adresse besteht bereits ein Konto.' });
			throw error;
		}
		return createSession(db, user);
	}

	async function login(emailInput, password) {
		const email = normalizeEmail(emailInput);
		if (!email || email.length > 254 || limiter.blocked(email) || pendingLogins.has(email)) return null;
		if (typeof password !== 'string' || password.length > 1024) { limiter.failed(email); return null; }
		// Pro E-Mail nur eine gleichzeitige Prüfung, damit parallele Requests die Sperre nicht umgehen.
		pendingLogins.add(email);
		try {
			const db = await authDb();
			const user = await db.collection('users').findOne({ email });
			dummyHash ??= hashPassword(createToken());
			const valid = await verifyPassword(password, user?.passwordHash ?? await dummyHash);
			if (!user || !valid) { limiter.failed(email); return null; }
			limiter.clear(email);
			return createSession(db, user);
		} finally { pendingLogins.delete(email); }
	}

	async function checkSession(token) {
		if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
		const db = await authDb();
		const session = await db.collection('sessions').findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date(now()) } });
		if (!session) return null;
		const user = await db.collection('users').findOne({ _id: session.userId }, { projection: { name: 1, email: 1 } });
		return user ? userView(user) : null;
	}

	async function logout(token) {
		if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return;
		await (await authDb()).collection('sessions').deleteOne({ tokenHash: hashToken(token) });
	}

	return { register, login, checkSession, logout };
}
