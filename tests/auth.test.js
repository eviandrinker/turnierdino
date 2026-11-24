import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { hashPassword, verifyPassword, hashToken, createToken } from '../src/lib/server/auth-crypto.js';
import { safeTarget, normalizeEmail, validateRegistration } from '../src/lib/auth-rules.js';
import { assertOwner, isOwner, PermissionError } from '../src/lib/server/permissions.js';
import { createLoginLimiter } from '../src/lib/server/login-limiter.js';
import { createAuthService, SESSION_SECONDS } from '../src/lib/server/auth-service.js';

test('scrypt: zufälliges Salt und richtiger/falscher Passwortvergleich', async () => {
	const password = 'Dino-Passwort äöü!';
	const first = await hashPassword(password), second = await hashPassword(password);
	assert.notEqual(first, second);
	assert.match(first, /^scrypt\$32768\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
	assert.equal(await verifyPassword(password, first), true);
	assert.equal(await verifyPassword(password + 'x', first), false);
	assert.equal(await verifyPassword('', first), false);
	assert.equal(await verifyPassword(password, 'invalid'), false);
	assert.equal(await verifyPassword(password, first.slice(0, -2)), false);
});

test('Token hat 32 zufällige Bytes, SHA-256 ist deterministisch', () => {
	const token = createToken();
	assert.match(token, /^[a-f0-9]{64}$/);
	assert.notEqual(token, createToken());
	assert.notEqual(hashToken(token), token);
	assert.equal(hashToken('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
	assert.equal(hashToken(token), hashToken(token));
});

test('Ziel-URLs: interne Pfade und Querys erlaubt, Redirect-Umgehungen gesperrt', () => {
	for (const value of ['/', '/turnier/neu', '/turnier/abc/teams?sort=name#oben', '/suchen?q=Dino%20Cup']) assert.equal(safeTarget(value), value);
	for (const value of [null, '', 'https://evil.example', '//evil.example', '///evil.example', 'javascript:alert(1)', '/\\evil.example', '/%5cevil.example', '/%2f%2fevil.example', '/%252f%252fevil.example', '/x/..//evil.example', '/x/%2e%2e//evil.example', '/%0d%0aLocation:evil', '/%00', '/%', ' /turnier/neu', '/\tevil']) {
		assert.equal(safeTarget(value), '/', String(value));
	}
	assert.equal(safeTarget('/a/../turnier/neu'), '/turnier/neu');
});

test('Besitzer darf ändern; fremd, anonym und Turniere ohne Besitzer sind gesperrt', () => {
	const ownerId = new ObjectId();
	const owner = { id: ownerId.toHexString() };
	const foreign = { id: new ObjectId().toHexString() };
	assert.equal(isOwner(owner, { ownerId }), true);
	assert.equal(isOwner(owner, { ownerId: owner.id }), true);
	assert.doesNotThrow(() => assertOwner(owner, { ownerId }));
	for (const tournament of [{ ownerId }, {}, { ownerId: null }]) {
		assert.equal(isOwner(null, tournament), false);
		assert.throws(() => assertOwner(null, tournament), (error) => error instanceof PermissionError && error.status === 401);
		assert.equal(isOwner(foreign, tournament), false);
		assert.throws(() => assertOwner(foreign, tournament), (error) => error.status === 403);
	}
	const legacy = Object.freeze({ name: 'Altes Turnier' });
	assert.throws(() => assertOwner(owner, legacy), (error) => error.status === 403);
	assert.deepEqual(legacy, { name: 'Altes Turnier' });
});

test('Registrierung prüft Name, E-Mail, Passwort und Wiederholung', () => {
	const input = { name: ' Dino ', email: ' DINO@Example.COM ', password: 'abcdefgh', passwordRepeat: 'abcdefgh' };
	assert.equal(normalizeEmail(input.email), 'dino@example.com');
	assert.deepEqual(validateRegistration(input).values, { name: 'Dino', email: 'dino@example.com' });
	assert.equal(validateRegistration(input).valid, true);
	assert.ok(validateRegistration({ ...input, name: '' }).errors.name);
	assert.ok(validateRegistration({ ...input, email: 'no-email' }).errors.email);
	assert.ok(validateRegistration({ ...input, password: 'short' }).errors.password);
	assert.ok(validateRegistration({ ...input, passwordRepeat: 'different' }).errors.passwordRepeat);
});

test('Fünf Fehlversuche sperren dieselbe E-Mail für eine Minute', () => {
	let time = 100;
	const limiter = createLoginLimiter(() => time);
	for (let i = 0; i < 5; i++) { assert.equal(limiter.blocked('DINO@EXAMPLE.COM'), false); limiter.failed('dino@example.com'); }
	assert.equal(limiter.blocked('Dino@example.com'), true);
	assert.equal(limiter.blocked('other@example.com'), false);
	time += 59999; assert.equal(limiter.blocked('dino@example.com'), true);
	time++; assert.equal(limiter.blocked('dino@example.com'), false);
	limiter.failed('dino@example.com'); limiter.clear('DINO@example.com');
	assert.equal(limiter.blocked('dino@example.com'), false);
});

// In-Memory-DB für Service-Unit-Tests; keine Verbindung zu MongoDB und keine HTTP/E2E-Tests.
function memoryDb() {
	const stores = new Map(), indexes = [];
	const same = (a, b) => a instanceof ObjectId || b instanceof ObjectId ? String(a) === String(b) : a === b;
	const matches = (row, query) => Object.entries(query).every(([key, value]) => value?.$gt ? row[key] > value.$gt : same(row[key], value));
	return {
		stores, indexes,
		collection(name) {
			if (!stores.has(name)) stores.set(name, []);
			const rows = stores.get(name);
			return {
				async createIndex(keys, options) { indexes.push({ name, keys, options }); },
				async insertOne(row) {
					const key = name === 'users' ? 'email' : 'tokenHash';
					if (rows.some((item) => item[key] === row[key])) throw Object.assign(new Error('duplicate'), { code: 11000 });
					rows.push(row);
				},
				async findOne(query) { return rows.find((row) => matches(row, query)) ?? null; },
				async deleteOne(query) { const i = rows.findIndex((row) => matches(row, query)); if (i !== -1) rows.splice(i, 1); }
			};
		}
	};
}

test('Registrierung und Session speichern ausschliesslich Hashes, Ablauf und Logout funktionieren', async () => {
	let time = Date.UTC(2026, 10, 24);
	const db = memoryDb();
	const auth = createAuthService(async () => db, () => time);
	const session = await auth.register({ name: 'Dino', email: 'DINO@example.com', password: 'testpass123', passwordRepeat: 'testpass123' });
	assert.equal(session.user.email, 'dino@example.com');
	assert.deepEqual(Object.keys(session.user).sort(), ['email', 'id', 'name']);
	assert.equal(db.stores.get('users')[0].password, undefined);
	assert.ok(db.stores.get('users')[0].passwordHash);
	assert.equal(db.stores.get('sessions')[0].token, undefined);
	assert.equal(db.stores.get('sessions')[0].tokenHash, hashToken(session.token));
	assert.equal(session.expiresAt.getTime(), time + SESSION_SECONDS * 1000);
	assert.deepEqual(await auth.checkSession(session.token), session.user);
	assert.equal(await auth.checkSession('bad'), null);
	assert.equal(await auth.checkSession(createToken()), null);
	assert.ok(db.indexes.some((index) => index.name === 'users' && index.keys.email === 1 && index.options.unique));
	assert.ok(db.indexes.some((index) => index.name === 'sessions' && index.keys.tokenHash === 1 && index.options.unique));
	assert.ok(db.indexes.some((index) => index.keys.expiresAt === 1 && index.options.expireAfterSeconds === 0));
	time += SESSION_SECONDS * 1000;
	assert.equal(await auth.checkSession(session.token), null, 'TTL-Verzögerung darf abgelaufene Sessions nicht verlängern');
	const login = await auth.login('dino@EXAMPLE.com', 'testpass123');
	assert.ok(login); assert.notEqual(login.token, session.token);
	await auth.logout(login.token);
	assert.equal(await auth.checkSession(login.token), null);
});

test('Login gibt bei falschen/unbekannten Konten null zurück und respektiert die Sperre', async () => {
	let time = 0;
	const db = memoryDb(), auth = createAuthService(async () => db, () => time);
	const input = { name: 'Dino', email: 'dino@example.com', password: 'testpass123', passwordRepeat: 'testpass123' };
	await auth.register(input);
	await assert.rejects(auth.register({ ...input, email: 'DINO@example.com' }), (error) => !!error.errors.email);
	assert.equal(await auth.login('unknown@example.com', input.password), null);
	for (let i = 0; i < 5; i++) assert.equal(await auth.login(input.email, 'wrong'), null);
	assert.equal(await auth.login(input.email, input.password), null);
	time = 60000;
	assert.ok(await auth.login(input.email, input.password));
});
