import { redirect } from '@sveltejs/kit';
import { requireStep, mutationFailure, getTournamentPage } from '#lib/server/tournament-flow.js';
import { createMatchSchedule, getMatches, advanceTournamentRound } from '#lib/server/db.js';
import { tournamentWinner, resolvePlaces } from '#lib/server/results.js';
import { isOwner } from '#lib/server/permissions.js';
import { creationStep } from '#lib/tournament-steps.js';
import { currentMatchday } from '#lib/matchdays.js';

export async function load({ params, locals }) {
	const data = await getTournamentPage(params.id);
	const canEdit = isOwner(locals.user, data.tournament);
	const step = creationStep(data.tournament, data.teams.length);
	if (canEdit && step) redirect(303, `/turnier/${params.id}/${step}`);
	if (!canEdit) delete data.tournament.joinCode;
	const storedMatches = await getMatches(params.id);
	const matches = resolvePlaces(storedMatches, data.teams, currentMatchday(data.tournament, storedMatches));
	if (canEdit && !matches.length && data.tournament.teamEntry === 'manuell') redirect(303, `/turnier/${params.id}/spielplan/erstellen`);
	return { ...data, canEdit, creationIncomplete: !!step, matches, winnerId: tournamentWinner(data.tournament, data.teams, matches) };
}

export const actions = {
	generate: async (event) => {
		const { params, locals } = event;
		await requireStep(params.id, '', event);
		try { await createMatchSchedule(params.id, locals.user); }
		catch (error) { return mutationFailure(error); }
		redirect(303, `/turnier/${params.id}`);
	},
	nextRound: async (event) => {
		const { params, request, locals } = event;
		await requireStep(params.id, '', event);
		const currentRound = Number((await request.formData()).get('currentRound'));
		try { await advanceTournamentRound(params.id, currentRound, locals.user); }
		catch (error) { return mutationFailure(error); }
		return { advanced: true };
	}
};
