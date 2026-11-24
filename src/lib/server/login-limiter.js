import { normalizeEmail } from '../auth-rules.js';

export function createLoginLimiter(now = Date.now) {
	const attempts = new Map();
	function state(email) {
		const time = now();
		for (const [key, value] of attempts) if (value.expiresAt <= time) attempts.delete(key);
		return attempts.get(normalizeEmail(email));
	}
	return {
		blocked(email) { return (state(email)?.failures ?? 0) >= 5; },
		failed(email) {
			const failures = (state(email)?.failures ?? 0) + 1;
			attempts.set(normalizeEmail(email), { failures, expiresAt: now() + 60000 });
		},
		clear(email) { attempts.delete(normalizeEmail(email)); }
	};
}
