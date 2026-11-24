import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password) {
	const salt = randomBytes(16);
	const hash = await derive(password, salt, 64, options);
	return `scrypt$32768$8$1$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
	if (typeof password !== 'string' || password.length > 1024 || typeof stored !== 'string') return false;
	const match = /^scrypt\$32768\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(stored);
	if (!match) return false;
	const actual = await derive(password, Buffer.from(match[1], 'hex'), 64, options);
	return timingSafeEqual(actual, Buffer.from(match[2], 'hex'));
}

export function createToken() { return randomBytes(32).toString('hex'); }
export function hashToken(token) { return createHash('sha256').update(token).digest('hex'); }
