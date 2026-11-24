/** Gruppen derselben Runde spielen am selben Spieltag; K.-o. folgt danach. */
export function matchdays(matches) {
	const buckets = new Map();
	for (const match of matches) {
		const key = `${match.phase}:${match.round}`;
		if (!buckets.has(key)) buckets.set(key, { key, phase: match.phase, round: match.round, roundName: match.roundName, matches: [] });
		buckets.get(key).matches.push(match);
	}
	return [...buckets.values()]
		.sort((a, b) => Number(a.phase === 'ko') - Number(b.phase === 'ko') || a.round - b.round)
		.map((day, index) => ({ ...day, number: index + 1,
			label: day.phase === 'ko' ? day.roundName : `${day.phase === 'gruppe' ? 'Gruppen' : 'Spieltag'} ${day.round}`,
			complete: day.matches.every((match) => match.status === 'Beendet')
		}));
}

export function currentMatchday(tournament, matches) {
	const days = matchdays(matches);
	if (Number.isInteger(tournament.currentRound) && tournament.currentRound >= 1) return Math.min(tournament.currentRound, days.length || 1);
	// Bestehende Turniere behalten ihre bereits gespielten Runden.
	return days.find((day) => !day.complete)?.number ?? (days.length || 1);
}

export function canAdvance(matches, currentRound) {
	const days = matchdays(matches);
	return Number.isInteger(currentRound) && currentRound >= 1 && currentRound < days.length && days.filter((day) => day.number <= currentRound).every((day) => day.complete);
}
