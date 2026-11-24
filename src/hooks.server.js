import { checkSession } from '#lib/server/auth.js';

export async function handle({ event, resolve }) {
	const token = event.cookies.get('session');
	event.locals.user = token ? await checkSession(token) : null;
	if (token && !event.locals.user) event.cookies.delete('session', { path: '/' });
	return resolve(event);
}
