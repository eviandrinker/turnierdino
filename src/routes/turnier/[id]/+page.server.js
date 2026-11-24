import { redirect } from '@sveltejs/kit';
import { requireStep, mutationFailure, getTournamentPage } from '#lib/server/tournament-flow.js';
import { fail } from '@sveltejs/kit';
import { createMatchSchedule, getMatches, advanceTournamentRound, getMyRegisteredTeam, removeRegisteredTeam } from '#lib/server/db.js';
import { tournamentWinner, resolvePlaces } from '#lib/server/results.js';
import { isOwner } from '#lib/server/permissions.js';
import { creationStep } from '#lib/tournament-steps.js';
import { currentMatchday } from '#lib/matchdays.js';

export async function load({ params, locals, url }) {
	const data = await getTournamentPage(params.id);
	const canEdit = isOwner(locals.user, data.tournament);
	const step = creationStep(data.tournament, data.teams.length);
	if (canEdit && step) redirect(303, `/turnier/${params.id}/${step}`);
	if (!canEdit) delete data.tournament.joinCode;
	const storedMatches = await getMatches(params.id);
	const matches = resolvePlaces(storedMatches, data.teams, currentMatchday(data.tournament, storedMatches));
	if (canEdit && !matches.length && data.tournament.teamEntry === 'manuell') redirect(303, `/turnier/${params.id}/spielplan/erstellen`);
	const ownTeam = locals.user ? await getMyRegisteredTeam(params.id, locals.user.id) : null;
	return {
		...data, canEdit, creationIncomplete: !!step, matches, ownTeam,
		justRegistered: !!ownTeam && url.searchParams.has('angemeldet'),
		winnerId: tournamentWinner(data.tournament, data.teams, matches)
	};
}

export const actions = {
	generate: async (event) => {
		const { params, locals } = event;
		await requireStep(params.id, '', event);
		try { await createMatchSchedule(params.id, locals.user); }
		catch (error) { return mutationFailure(error); }
		redirect(303, `/turnier/${params.id}`);
	},
	removeTeam: async (event) => {
		const { params, request, locals } = event;
		await requireStep(params.id, '', event);
		const form = await request.formData();
		if (form.get('confirmed') !== 'yes') return fail(400, { message: 'Bitte bestätige das Entfernen.' });
		const teamId = typeof form.get('teamId') === 'string' ? form.get('teamId') : '';
		try { await removeRegisteredTeam(params.id, teamId, locals.user); }
		catch (error) { return mutationFailure(error); }
		return { removed: true, message: 'Das Team wurde entfernt.' };
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
