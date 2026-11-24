import { isOpenForRegistration } from './registration-rules.js';

export const SEARCH_CATEGORIES = ['offen', 'laufend', 'abgeschlossen'];
export const SEARCH_PAGE_SIZE = 12;
export const MAX_QUERY_LENGTH = 100;
const MAX_PAGE = 500;

export const categoryLabels = { offen: 'Offen', laufend: 'Laufend', abgeschlossen: 'Abgeschlossen' };
export const sectionTitles = { offen: 'Offen für Anmeldungen', laufend: 'Laufend', abgeschlossen: 'Abgeschlossen' };
export const modeLabels = { liga: 'Liga', gruppen_ko: 'Gruppen + K.-o.', ko: 'Nur K.-o.' };

/** Bereich in der Suche oder null (Entwürfe und Turniere ohne passenden Bereich erscheinen nie). */
export function searchCategory(tournament, teamCount, hasMatches) {
	if (!tournament || tournament.status === 'Entwurf') return null;
	if (isOpenForRegistration(tournament, teamCount, hasMatches)) return 'offen';
	if (tournament.status === 'Abgeschlossen') return 'abgeschlossen';
	const planExists = !!hasMatches || !!tournament.planCreatedAt;
	if (planExists && ['Bereit', 'Läuft'].includes(tournament.status)) return 'laufend';
	return null;
}

/** Maskiert alle RegExp-Sonderzeichen, damit der Suchtext nur wörtlich verglichen wird. */
export function escapeRegExp(text) {
	return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeQuery(value) {
	return typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY_LENGTH) : '';
}

/** MongoDB-Filter für den Turniernamen; ohne Suchtext kein Filter. */
export function nameFilter(query) {
	const q = normalizeQuery(query);
	return q ? { name: { $regex: escapeRegExp(q), $options: 'i' } } : {};
}

export function parseSearchQuery(params) {
	const q = normalizeQuery(params.get('q'));
	const kategorie = params.get('kategorie');
	const category = SEARCH_CATEGORIES.includes(kategorie) ? kategorie : 'alle';
	const page = Number.parseInt(params.get('seite') ?? '1', 10);
	return { q, category, page: Number.isInteger(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1 };
}

const byNewest = (a, b) => new Date(b.createdAt) - new Date(a.createdAt) || String(a._id ?? a.id).localeCompare(String(b._id ?? b.id));
const free = (row) => row.teamCount - row.registeredCount;
// Startzeiten sind «HH:MM»; Turniere ohne Startzeit kommen zuletzt.
const startKey = (row) => typeof row.startTime === 'string' && /^\d{2}:\d{2}$/.test(row.startTime) ? row.startTime : '99:99';

export const searchComparators = {
	offen: (a, b) => free(b) - free(a) || byNewest(a, b),
	laufend: (a, b) => startKey(a).localeCompare(startKey(b)) || byNewest(a, b),
	abgeschlossen: byNewest
};

/** Teilt Zeilen (mit registeredCount und hasMatches) in die Bereiche auf und sortiert sie. */
export function groupByCategory(rows) {
	const groups = Object.fromEntries(SEARCH_CATEGORIES.map((key) => [key, []]));
	for (const row of rows) {
		const category = searchCategory(row, row.registeredCount, row.hasMatches);
		if (category) groups[category].push(row);
	}
	for (const key of SEARCH_CATEGORIES) groups[key].sort(searchComparators[key]);
	return groups;
}

export function pageOf(items, page, size = SEARCH_PAGE_SIZE) {
	const start = (page - 1) * size;
	return { items: items.slice(start, start + size), page, hasMore: items.length > start + size };
}

/** Explizite öffentliche Felder; niemals joinCode, ownerId oder andere Benutzer-IDs. */
export function publicTournament(row, category, winner = null) {
	return {
		id: String(row.id ?? row._id), name: row.name, mode: row.mode, startTime: row.startTime ?? null,
		status: row.status, category, registeredCount: row.registeredCount ?? 0, teamCount: row.teamCount,
		winner: category === 'abgeschlossen' ? winner : null
	};
}
