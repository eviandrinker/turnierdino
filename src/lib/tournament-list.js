import { creationStep } from './tournament-steps.js';

export const tournamentFilters = [
	{ key: 'all', label: 'Alle' }, { key: 'running', label: 'Laufend' },
	{ key: 'drafts', label: 'Entwürfe' }, { key: 'completed', label: 'Abgeschlossen' }
];
const priority = { 'Läuft': 0, Bereit: 1, Entwurf: 2, Abgeschlossen: 3 };
const matches = (tournament, filter) => filter === 'running' ? ['Läuft', 'Bereit'].includes(tournament.status)
	: filter === 'drafts' ? tournament.status === 'Entwurf'
	: filter === 'completed' ? tournament.status === 'Abgeschlossen' : true;

export function tournamentList(tournaments, filter = 'all') {
	const selected = tournamentFilters.some((item) => item.key === filter) ? filter : 'all';
	const counts = Object.fromEntries(tournamentFilters.map(({ key }) => [key, tournaments.filter((t) => matches(t, key)).length]));
	const items = tournaments.filter((t) => matches(t, selected)).sort((a, b) =>
		(priority[a.status] ?? 4) - (priority[b.status] ?? 4) || new Date(b.createdAt) - new Date(a.createdAt) || a.id.localeCompare(b.id)
	);
	return { items, counts, selected };
}

export function tournamentDestination(tournament, registeredCount) {
	const base = `/turnier/${tournament.id}`;
	if (tournament.status !== 'Entwurf') return base;
	const step = creationStep(tournament, registeredCount);
	return step ? `${base}/${step}` : base;
}
