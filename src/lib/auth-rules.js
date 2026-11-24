export function normalizeEmail(email) { return typeof email === 'string' ? email.trim().toLowerCase() : ''; }

export function safeTarget(value) {
	if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') || value.startsWith('//') || /\s/.test(value)) return '/';
	// Auch kodierte Backslashes, Steuerzeichen und Protokoll-relative URLs ausschliessen.
	let decoded = value;
	for (let i = 0; i < 5; i++) {
		if (!decoded.startsWith('/') || decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decoded)) return '/';
		const normalized = new URL(decoded, 'https://turnierdino.invalid');
		if (normalized.origin !== 'https://turnierdino.invalid' || normalized.pathname.startsWith('//')) return '/';
		let next;
		try { next = decodeURIComponent(decoded); } catch { return '/'; }
		if (next === decoded) {
			const url = new URL(value, 'https://turnierdino.invalid');
			return url.origin === 'https://turnierdino.invalid' && !url.pathname.startsWith('//') ? url.pathname + url.search + url.hash : '/';
		}
		decoded = next;
	}
	return '/';
}

export function validateRegistration(input) {
	const name = typeof input.name === 'string' ? input.name.trim() : '';
	const email = normalizeEmail(input.email);
	const errors = {};
	if (name.length < 2 || name.length > 60) errors.name = 'Bitte gib einen Namen mit 2–60 Zeichen ein.';
	if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Bitte gib eine gültige E-Mail-Adresse ein.';
	if (typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 1024) errors.password = 'Das Passwort muss 8–1024 Zeichen lang sein.';
	if (input.password !== input.passwordRepeat) errors.passwordRepeat = 'Die Passwörter stimmen nicht überein.';
	return { valid: Object.keys(errors).length === 0, errors, values: { name, email } };
}
