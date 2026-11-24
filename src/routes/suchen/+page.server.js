import { searchTournaments } from '#lib/server/db.js';
import { parseSearchQuery } from '#lib/tournament-search.js';

export async function load({ url }) {
	// Die Seite lädt immer die erste Seite; «Mehr anzeigen» holt weitere über /api/turniere.
	return searchTournaments({ ...parseSearchQuery(url.searchParams), page: 1 });
}
