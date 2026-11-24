import { fail, redirect } from '@sveltejs/kit';
import { updateTournament } from '#lib/server/db.js';
import { mutationFailure, requireStep } from '#lib/server/tournament-flow.js';

export const load = (event) => requireStep(event.params.id, 'teams', event);

export const actions = {
	default: async (event) => {
		const { params, request, locals } = event;
		await requireStep(params.id, 'teams', event);
		const form = await request.formData();
		const teamEntry = form.get('teamEntry');
		if (!['manuell', 'code'].includes(teamEntry)) return fail(400, { message: 'Bitte wähle ja oder nein.' });
		try { await updateTournament(params.id, { teamEntry }, locals.user); }
		catch (error) { return mutationFailure(error, { teamEntry }); }
		redirect(303, `/turnier/${params.id}/${teamEntry === 'manuell' ? 'teams/manuell' : 'ablauf'}`);
	}
};
