export function parseScore(value) {
	if (value === null || value === '') return null;
	if (typeof value === 'number') return Number.isInteger(value) && value >= 0 && value <= 99 ? value : NaN;
	return typeof value === 'string' && /^\d{1,2}$/.test(value) ? Number(value) : NaN;
}

export function validateResult(input, phase) {
	const scoreA = parseScore(input.scoreA), scoreB = parseScore(input.scoreB);
	let error = '';
	const incomplete = !Number.isNaN(scoreA) && !Number.isNaN(scoreB) && ((scoreA === null) !== (scoreB === null));
	if (Number.isNaN(scoreA) || Number.isNaN(scoreB)) error = 'Tore müssen ganze Zahlen von 0–99 sein.';
	else if (incomplete) error = 'Bitte beide Resultatfelder ausfüllen oder beide leer lassen.';
	else if (phase === 'ko' && scoreA !== null && scoreA === scoreB) error = 'Im K.-o. braucht es einen Sieger';
	return { valid: !error, incomplete, error, values: { scoreA, scoreB, status: scoreA === null ? 'Geplant' : 'Beendet' } };
}

export function resultVersion(match) {
	return { scoreA: match.scoreA, scoreB: match.scoreB, teamAId: match.teamAId, teamBId: match.teamBId };
}
