import { json } from '@sveltejs/kit';
import { searchTournaments } from '#lib/server/db.js';
import { parseSearchQuery } from '#lib/tournament-search.js';

export async function GET({ url }) {
	return json(await searchTournaments(parseSearchQuery(url.searchParams)), { headers: { 'Cache-Control': 'no-store' } });
}
