import { error, fail, redirect } from '@sveltejs/kit';
import { getTeams, getTournament, TournamentInputError } from './db.js';
import { requireUser, requireOwner } from './auth-http.js';
import { PermissionError } from './permissions.js';
import { creationStep } from '../tournament-steps.js';

export async function getTournamentPage(id) {
	const tournament = await getTournament(id);
	if (!tournament) error(404, 'Dieses Turnier wurde nicht gefunden.');
	const teams = await getTeams(id);
	const { _id, ownerId, ...rest } = tournament;
	return {
		tournament: { ...rest, id: _id.toHexString(), ownerId: ownerId?.toString() ?? null },
		teams: teams.map((team) => ({ id: team._id.toHexString(), name: team.name, group: team.group ?? null }))
	};
}

export async function requireStep(id, requested, event) {
	requireUser(event);
	const data = await getTournamentPage(id);
	requireOwner(event, data.tournament);
	const { tournament, teams } = data;
	const step = creationStep(tournament, teams.length);
	const manual = requested === 'teams/manuell' && tournament.teamEntry === 'manuell' && tournament.status === 'Entwurf';
	const code = requested === 'code' && !step && tournament.teamEntry === 'code';
	if (requested !== step && !manual && !code) redirect(303, `/turnier/${id}${step ? `/${step}` : ''}`);
	return data;
}

export function mutationFailure(cause, values = {}) {
	if (cause instanceof PermissionError) error(cause.status, cause.message);
	const failure = cause;
	if (failure instanceof TournamentInputError) return fail(400, { ...values, errors: failure.errors, message: failure.message });
	return fail(503, { ...values, errors: {}, message: 'Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.' });
}
