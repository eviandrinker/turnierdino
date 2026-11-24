import { redirect, error } from '@sveltejs/kit';
import { logout } from '#lib/server/auth.js';

export async function POST({ cookies, locals, request, url }) {
	if (request.headers.get('origin') !== url.origin) error(403, 'Diese Anfrage ist nicht erlaubt.');
	await logout(cookies.get('session'));
	cookies.delete('session', { path: '/' });
	locals.user = null;
	redirect(303, '/');
}
