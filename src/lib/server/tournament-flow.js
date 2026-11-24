import { error, fail, redirect } from '@sveltejs/kit';
import { getTeams, getTournament, TournamentInputError } from './db.js';
import { creationStep } from '../tournament-steps.js';

export async function requireStep(id, requested) {
	const tournament = await getTournament(id);
	if (!tournament) error(404, 'Dieses Turnier wurde nicht gefunden.');
	const teams = await getTeams(id);
	const step = creationStep(tournament, teams.length);
	const manual = requested === 'teams/manuell' && tournament.teamEntry === 'manuell' && tournament.status === 'Entwurf';
	const code = requested === 'code' && !step && tournament.teamEntry === 'code';
	if (requested !== step && !manual && !code) redirect(303, `/turnier/${id}${step ? `/${step}` : ''}`);
	const { _id, ...rest } = tournament;
	return {
		tournament: { ...rest, id: _id.toHexString() },
		teams: teams.map((team) => ({ id: team._id.toHexString(), name: team.name }))
	};
}

export function mutationFailure(error, values = {}) {
	if (error instanceof TournamentInputError) return fail(400, { ...values, errors: error.errors, message: error.message });
	return fail(503, { ...values, errors: {}, message: 'Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.' });
}
