import { json } from '@sveltejs/kit';
import { getOpenTournaments } from '#lib/server/db.js';
export async function GET() {
	return json(await getOpenTournaments(), { headers: { 'Cache-Control': 'no-store' } });
}
