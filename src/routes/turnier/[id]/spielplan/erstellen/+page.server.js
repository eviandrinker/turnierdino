import { redirect } from '@sveltejs/kit';
import { requireStep, mutationFailure } from '#lib/server/tournament-flow.js';
import { createMatchSchedule, getMatches } from '#lib/server/db.js';

export async function load(event) {
	const { params } = event;
	const data = await requireStep(params.id, '', event);
	if ((await getMatches(params.id)).length || data.tournament.teamEntry !== 'manuell') redirect(303, `/turnier/${params.id}`);
	return data;
}

export const actions = {
	default: async (event) => {
		const { params, locals } = event;
		await requireStep(params.id, '', event);
		try { await createMatchSchedule(params.id, locals.user); }
		catch (error) { return mutationFailure(error); }
		redirect(303, `/turnier/${params.id}`);
	}
};
