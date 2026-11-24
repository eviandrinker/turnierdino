import { dev } from '$app/env';
import { error, redirect } from '@sveltejs/kit';
import { SESSION_SECONDS } from './auth.js';
import { assertOwner, PermissionError } from './permissions.js';

export function requireUser(event) {
	if (!event.locals.user) redirect(303, `/login?ziel=${encodeURIComponent(event.url.pathname + event.url.search)}`);
	return event.locals.user;
}
export function requireOwner(event, tournament) {
	requireUser(event);
	try { assertOwner(event.locals.user, tournament); }
	catch (cause) { if (cause instanceof PermissionError) error(cause.status, cause.message); throw cause; }
}
export function setSessionCookie(cookies, session) {
	cookies.set('session', session.token, { httpOnly: true, sameSite: 'lax', secure: !dev, path: '/', maxAge: SESSION_SECONDS, expires: session.expiresAt });
}
