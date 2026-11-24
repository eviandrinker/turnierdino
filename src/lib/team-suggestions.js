import { normalizeTeamName, validateTeam } from './team-rules.js';

/** Häufigkeit zählt eigene Turniere, nicht unterschiedliche Schreibweisen im selben Turnier. */
export function teamSuggestions(userId, currentTournamentId, tournaments, teams) {
	const ownIds = new Set(tournaments.filter((t) => String(t.ownerId) === userId && String(t.id) !== currentTournamentId).map((t) => String(t.id)));
	const present = new Set(teams.filter((team) => String(team.tournamentId) === currentTournamentId).map((team) => normalizeTeamName(team.name)));
	const suggestions = new Map();
	for (const team of teams) {
		if (!ownIds.has(String(team.tournamentId))) continue;
		const name = team.name.trim().normalize('NFC');
		const key = normalizeTeamName(name);
		if (present.has(key) || !validateTeam({ name }, [], 1).valid) continue;
		const used = new Date(team.createdAt).getTime();
		const lastUsed = Number.isFinite(used) ? used : 0;
		const existing = suggestions.get(key);
		if (!existing) suggestions.set(key, { name, lastUsed, tournaments: new Set([String(team.tournamentId)]) });
		else {
			existing.tournaments.add(String(team.tournamentId));
			if (lastUsed > existing.lastUsed) { existing.name = name; existing.lastUsed = lastUsed; }
		}
	}
	return [...suggestions.values()].map(({ name, lastUsed, tournaments }) => ({ name, lastUsed, frequency: tournaments.size }))
		.sort((a, b) => b.frequency - a.frequency || b.lastUsed - a.lastUsed || a.name.localeCompare(b.name, 'de'))
		.slice(0, 20);
}

export function selectTeamImports(sourceTeams, currentTeams, teamCount) {
	const result = [], known = [...currentTeams];
	for (const team of sourceTeams) {
		if (known.length >= teamCount) break;
		const validation = validateTeam({ name: team.name }, known, teamCount);
		if (!validation.valid) continue;
		result.push(validation.values); known.push(validation.values);
	}
	return result;
}
