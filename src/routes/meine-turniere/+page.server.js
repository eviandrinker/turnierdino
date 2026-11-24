import { fail } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth-http.js';
import { getMyTournaments, deleteTournament, getParticipations } from '#lib/server/db.js';
import { mutationFailure } from '#lib/server/tournament-flow.js';
import { tournamentList } from '#lib/tournament-list.js';

export async function load(event) {
	const user = requireUser(event);
	const filter = event.url.searchParams.get('filter');
	const [own, participations] = await Promise.all([getMyTournaments(user.id), getParticipations(user.id)]);
	const list = tournamentList(own, filter);
	return {
		...list, participations,
		selected: filter === 'teilnahmen' ? 'teilnahmen' : list.selected,
		counts: { ...list.counts, teilnahmen: participations.length }
	};
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
