import { fail, redirect } from '@sveltejs/kit';
import { register, logout, RegistrationError } from '#lib/server/auth.js';
import { setSessionCookie } from '#lib/server/auth-http.js';
import { safeTarget, normalizeEmail } from '#lib/auth-rules.js';

export const load = ({ url }) => ({ target: safeTarget(url.searchParams.get('ziel')) });
export const actions = {
	default: async ({ request, cookies, locals, url }) => {
		const form = await request.formData();
		const input = Object.fromEntries(['name', 'email', 'password', 'passwordRepeat'].map((key) => [key, form.get(key)]));
		const values = { name: typeof input.name === 'string' ? input.name : '', email: normalizeEmail(input.email) };
		let session;
		try {
			session = await register(input);
			await logout(cookies.get('session'));
		} catch (error) {
			if (error instanceof RegistrationError) return fail(400, { values, errors: error.errors });
			return fail(503, { values, message: 'Die Registrierung ist momentan nicht möglich. Bitte versuche es erneut.' });
		}
		setSessionCookie(cookies, session);
		locals.user = session.user;
		redirect(303, safeTarget(url.searchParams.get('ziel')));
	}
};
