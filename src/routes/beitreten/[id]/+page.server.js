import { error, fail, redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth-http.js';
import { getRegistrationDetails, registerTeam, unregisterTeam } from '#lib/server/db.js';
import { mutationFailure } from '#lib/server/tournament-flow.js';

export async function load(event) {
	const user = requireUser(event);
	const details = await getRegistrationDetails(event.params.id, user);
	if (!details) error(404, 'Dieses Turnier wurde nicht gefunden.');
	return details;
}
export const actions = {
	register: async (event) => {
		const user = requireUser(event);
		const data = await event.request.formData();
		const name = typeof data.get('name') === 'string' ? data.get('name') : '';
		try { await registerTeam(event.params.id, { name }, user); }
		catch (cause) { return mutationFailure(cause, { name }); }
		redirect(303, `/turnier/${event.params.id}?angemeldet=1`);
	},
	withdraw: async (event) => {
		const user = requireUser(event);
		const data = await event.request.formData();
		if (data.get('confirmed') !== 'yes') return fail(400, { message: 'Bitte bestätige die Abmeldung.' });
		try { await unregisterTeam(event.params.id, user); }
		catch (cause) { return mutationFailure(cause); }
		return { withdrawn: true, message: 'Dein Team ist abgemeldet.' };
	}
};
