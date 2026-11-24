import { redirect } from '@sveltejs/kit';
import { requireStep, mutationFailure } from '#lib/server/tournament-flow.js';
import { createMatchSchedule, getMatches } from '#lib/server/db.js';

export async function load({ params }) {
	const data = await requireStep(params.id, '');
	if ((await getMatches(params.id)).length || data.tournament.teamEntry !== 'manuell') redirect(303, `/turnier/${params.id}`);
	return data;
}

export const actions = {
	default: async ({ params }) => {
		await requireStep(params.id, '');
		try { await createMatchSchedule(params.id); }
		catch (error) { return mutationFailure(error); }
		redirect(303, `/turnier/${params.id}`);
	}
};
