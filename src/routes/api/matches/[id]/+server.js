import { json } from '@sveltejs/kit';
import { getMatch, saveMatchResults, TournamentInputError } from '#lib/server/db.js';

export async function PATCH({ params, request, url }) {
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) return json({ message: 'Diese Anfrage ist nicht erlaubt.' }, { status: 403 });
	let input;
	try {
		input = await request.json();
		if (!input || !input.expected || !['scoreA', 'scoreB', 'teamAId', 'teamBId'].every((key) => Object.hasOwn(input.expected, key))) throw new Error();
	} catch { return json({ message: 'Ungültige Resultatdaten. Bitte aktualisiere die Seite.' }, { status: 400 }); }
	try {
		const match = await getMatch(params.id);
		if (!match) return json({ message: 'Dieses Spiel wurde nicht gefunden.' }, { status: 404 });
		const snapshot = await saveMatchResults(match.tournamentId.toHexString(), [{
			matchNumber: match.matchNumber, scoreA: input.scoreA, scoreB: input.scoreB, expected: input.expected
		}]);
		return json({ snapshot });
	} catch (error) {
		if (error instanceof TournamentInputError) return json({
			message: Object.values(error.errors)[0] ?? error.message, snapshot: error.snapshot
		}, { status: 409 });
		return json({ message: 'Speichern fehlgeschlagen. Bitte versuche es erneut.' }, { status: 503 });
	}
}
