import { error } from '@sveltejs/kit';
import { getTournament } from '#lib/server/db.js';

export async function load({ params }) {
	const tournament = await getTournament(params.id);
	if (!tournament) error(404, 'Dieses Turnier wurde nicht gefunden.');
	return { tournament: { id: tournament._id.toHexString(), name: tournament.name } };
}
