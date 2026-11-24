import { fail, redirect } from '@sveltejs/kit';
import { login, logout } from '#lib/server/auth.js';
import { setSessionCookie } from '#lib/server/auth-http.js';
import { safeTarget, normalizeEmail } from '#lib/auth-rules.js';

export const load = ({ url }) => ({ target: safeTarget(url.searchParams.get('ziel')) });
export const actions = {
	default: async ({ request, cookies, locals, url }) => {
		const form = await request.formData();
		const email = normalizeEmail(form.get('email'));
		const message = 'E-Mail oder Passwort ist falsch';
		let session;
		try {
			session = await login(email, form.get('password'));
			if (!session) return fail(400, { email, message });
			await logout(cookies.get('session'));
		} catch { return fail(503, { email, message }); }
		setSessionCookie(cookies, session);
		locals.user = session.user;
		redirect(303, safeTarget(url.searchParams.get('ziel')));
	}
};
