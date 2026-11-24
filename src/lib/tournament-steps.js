import { validateSchedule } from './schedule-rules.js';

export function creationStep(tournament, teamCount) {
	if (!['manuell', 'code'].includes(tournament.teamEntry)) return 'teams';
	if (tournament.teamEntry === 'code' && !/^\d{6}$/.test(tournament.joinCode ?? '')) return 'teams';
	if (tournament.teamEntry === 'manuell' && teamCount !== tournament.teamCount) return 'teams/manuell';
	if (tournament.status === 'Entwurf' || !validateSchedule(tournament).valid) return 'ablauf';
	return '';
}
