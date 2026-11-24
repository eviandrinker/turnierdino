import { redirect } from '@sveltejs/kit';
import { requireStep, mutationFailure } from '#lib/server/tournament-flow.js';
import { createMatchSchedule, getMatches, advanceTournamentRound } from '#lib/server/db.js';
import { tournamentWinner, resolvePlaces } from '#lib/server/results.js';
import { currentMatchday } from '#lib/matchdays.js';

export async function load({ params }) {
	const data = await requireStep(params.id, '');
	const storedMatches = await getMatches(params.id);
	const matches = resolvePlaces(storedMatches, data.teams, currentMatchday(data.tournament, storedMatches));
	if (!matches.length && data.tournament.teamEntry === 'manuell') redirect(303, `/turnier/${params.id}/spielplan/erstellen`);
	return { ...data, matches, winnerId: tournamentWinner(data.tournament, data.teams, matches) };
}

export const actions = {
	generate: async ({ params }) => {
		await requireStep(params.id, '');
		try { await createMatchSchedule(params.id); }
		catch (error) { return mutationFailure(error); }
		redirect(303, `/turnier/${params.id}`);
	},
	nextRound: async ({ params, request }) => {
		await requireStep(params.id, '');
		const currentRound = Number((await request.formData()).get('currentRound'));
		try { await advanceTournamentRound(params.id, currentRound); }
		catch (error) { return mutationFailure(error); }
		return { advanced: true };
	}
};
