/** Die Eingabereihenfolge entscheidet bei vollständigem Gleichstand. */
export function calculateStandings(teams, matches) {
	const rows = teams.map((team) => ({
		teamId: team.id, name: team.name, played: 0, wins: 0, draws: 0,
		losses: 0, goalsFor: 0, goalsAgainst: 0, difference: 0, points: 0
	}));
	const byId = new Map(rows.map((row) => [row.teamId, row]));
	for (const match of matches) {
		if (match.status !== 'Beendet' || match.phase === 'ko') continue;
		const a = byId.get(match.teamAId), b = byId.get(match.teamBId);
		if (!a || !b || !Number.isInteger(match.scoreA) || !Number.isInteger(match.scoreB)) continue;
		a.played++; b.played++;
		a.goalsFor += match.scoreA; a.goalsAgainst += match.scoreB;
		b.goalsFor += match.scoreB; b.goalsAgainst += match.scoreA;
		if (match.scoreA === match.scoreB) { a.draws++; b.draws++; a.points++; b.points++; }
		else {
			const [winner, loser] = match.scoreA > match.scoreB ? [a, b] : [b, a];
			winner.wins++; winner.points += 3; loser.losses++;
		}
	}
	for (const row of rows) row.difference = row.goalsFor - row.goalsAgainst;
	rows.sort((a, b) => b.points - a.points || b.difference - a.difference || b.goalsFor - a.goalsFor);
	return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}
