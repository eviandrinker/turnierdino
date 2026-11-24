import { fail } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth-http.js';
import { getMyTournaments, deleteTournament } from '#lib/server/db.js';
import { mutationFailure } from '#lib/server/tournament-flow.js';
import { tournamentList } from '#lib/tournament-list.js';

export async function load(event) {
	const user = requireUser(event);
	return tournamentList(await getMyTournaments(user.id), event.url.searchParams.get('filter'));
}
export const actions = {
	delete: async (event) => {
		const user = requireUser(event);
		const form = await event.request.formData();
		if (form.get('confirmed') !== 'yes') return fail(400, { message: 'Bitte bestätige das Löschen.' });
		try { await deleteTournament(form.get('id'), user); }
		catch (error) { return mutationFailure(error); }
		return { deleted: true, message: 'Turnier gelöscht.' };
	}
};
