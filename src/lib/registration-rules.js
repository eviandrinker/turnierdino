import { validateTeam } from './team-rules.js';

export function isOpenForRegistration(tournament, teamCount, hasMatches) {
	return !!tournament && tournament.teamEntry === 'code' && tournament.status === 'Bereit'
		&& !hasMatches && !tournament.planCreatedAt
		&& Number.isInteger(teamCount) && teamCount >= 0 && teamCount < tournament.teamCount;
}

export function registrationClosedMessage(tournament, teamCount, hasMatches) {
	if (isOpenForRegistration(tournament, teamCount, hasMatches)) return '';
	if (hasMatches || tournament?.planCreatedAt || ['Läuft', 'Abgeschlossen'].includes(tournament?.status)) return 'Dieses Turnier hat schon begonnen';
	if (tournament?.teamEntry === 'code' && tournament.status === 'Bereit' && teamCount >= tournament.teamCount) return 'Alle Plätze sind vergeben';
	return 'Dieses Turnier nimmt keine Anmeldungen an';
}

export function validateTeamRegistration(tournament, teams, hasMatches, userId, input) {
	if (!userId) return { valid: false, message: 'Bitte melde dich zuerst an.', errors: {} };
	if (teams.some((team) => team.registeredBy && String(team.registeredBy) === userId)) return { valid: false, message: 'Du hast bereits ein Team in diesem Turnier angemeldet.', errors: {} };
	const message = registrationClosedMessage(tournament, teams.length, hasMatches);
	if (message) return { valid: false, message, errors: {} };
	const result = validateTeam(input, teams, tournament.teamCount);
	return { ...result, message: result.valid ? '' : 'Bitte prüfe den Teamnamen.' };
}

/** Explizite öffentliche Felder; niemals joinCode oder Benutzer-IDs ausgeben. */
export function openTournamentList(rows) {
	return rows.filter((row) => isOpenForRegistration(row, row.registeredCount, row.hasMatches))
		.sort((a, b) => (b.teamCount - b.registeredCount) - (a.teamCount - a.registeredCount)
			|| new Date(b.createdAt) - new Date(a.createdAt) || String(a.id ?? a._id).localeCompare(String(b.id ?? b._id)))
		.slice(0, 50).map((row) => ({
			id: String(row.id ?? row._id), name: row.name, mode: row.mode, startTime: row.startTime,
			registeredCount: row.registeredCount, teamCount: row.teamCount
		}));
}
