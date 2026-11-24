import { calculateStandings } from '../standings.js';
import { matchdays, canAdvance } from '../matchdays.js';
import { validateResult } from '../result-rules.js';

export function winnerOf(match) {
	if (!match || match.status !== 'Beendet' || match.scoreA === match.scoreB) return null;
	return match.scoreA > match.scoreB ? match.teamAId : match.teamBId;
}

export function resolvePlaces(inputMatches, teams, currentRound = Infinity) {
	const matches = inputMatches.map((match) => ({ ...match }));
	const byNumber = new Map(matches.map((match) => [match.matchNumber, match]));
	const dayNumbers = new Map(matchdays(matches).flatMap((day) => day.matches.map((match) => [match.matchNumber, day.number])));
	const groupMatches = matches.filter((match) => match.phase === 'gruppe');
	const groupsDone = groupMatches.length > 0 && groupMatches.every((match) => match.status === 'Beendet');
	const tables = new Map();
	if (groupsDone) {
		for (const group of new Set(teams.map((team) => team.group))) {
			tables.set(group, calculateStandings(teams.filter((team) => team.group === group), groupMatches.filter((match) => match.group === group)));
		}
	}
	function resolve(source) {
		if (source.type === 'winner') return winnerOf(byNumber.get(source.matchNumber));
		if (source.type === 'group') return tables.get(source.group)?.[source.rank - 1]?.teamId ?? null;
		return null;
	}
	for (const match of [...matches].sort((a, b) => a.matchNumber - b.matchNumber)) {
		for (const side of ['A', 'B']) {
			const source = match[`source${side}`];
			if (source) match[`team${side}Id`] = source.type === 'winner' && dayNumbers.get(match.matchNumber) > currentRound ? null : resolve(source);
		}
	}
	return matches;
}

function dependentMatches(match, matches) {
	const found = new Set();
	const visit = (parent) => {
		for (const child of matches) {
			if (found.has(child.matchNumber)) continue;
			if ([child.sourceA, child.sourceB].some((source) => source && (
				(source.type === 'winner' && source.matchNumber === parent.matchNumber) ||
				(parent.phase === 'gruppe' && source.type === 'group' && source.group === parent.group)
			))) {
				found.add(child.matchNumber); visit(child);
			}
		}
	};
	visit(match);
	return matches.filter((candidate) => found.has(candidate.matchNumber));
}

/** Atomare Batch-Prüfung: Bei Fehlern wird kein Resultat angewendet. */
export function applyResults(original, teams, entries, { currentRound = Infinity } = {}) {
	const errors = {};
	const byNumber = new Map(original.map((match) => [match.matchNumber, match]));
	const changes = new Map();
	const dayNumbers = new Map(matchdays(original).flatMap((day) => day.matches.map((match) => [match.matchNumber, day.number])));
	const seen = new Set();
	for (const entry of entries) {
		const number = entry.matchNumber;
		const match = byNumber.get(number);
		if (!match || seen.has(number)) { errors[number] = 'Dieses Spiel ist ungültig.'; continue; }
		seen.add(number);
		if (dayNumbers.get(number) > currentRound) { errors[number] = `Wird freigeschaltet, sobald Spieltag ${dayNumbers.get(number) - 1} fertig ist`; continue; }
		const validation = validateResult(entry, match.phase);
		if (!validation.valid) { errors[number] = validation.error; continue; }
		const { scoreA, scoreB } = validation.values;
		if (scoreA === match.scoreA && scoreB === match.scoreB) continue;
		if (entry.expected && (entry.expected.scoreA !== match.scoreA || entry.expected.scoreB !== match.scoreB ||
			entry.expected.teamAId !== match.teamAId || entry.expected.teamBId !== match.teamBId)) {
			errors[number] = 'Dieses Spiel wurde inzwischen geändert. Bitte aktualisiere die Seite und prüfe dein Resultat.'; continue;
		}
		if (!match.teamAId || !match.teamBId) { errors[number] = 'Die Teams dieses Spiels stehen noch nicht fest.'; continue; }
		changes.set(number, { scoreA, scoreB, status: scoreA === null ? 'Geplant' : 'Beendet' });
	}
	for (const [number] of changes) {
		const match = byNumber.get(number);
		if (match.status !== 'Beendet') continue;
		if (dependentMatches(match, original).some((dependent) => dependent.status === 'Beendet' || changes.get(dependent.matchNumber)?.status === 'Beendet')) {
			errors[number] = 'Korrektur gesperrt: Ein abhängiges K.-o.-Spiel wurde bereits gespielt.';
		}
	}
	if (Object.keys(errors).length) return { valid: false, errors };
	const matches = resolvePlaces(original.map((match) => ({ ...match, ...changes.get(match.matchNumber) })), teams, currentRound);
	// Auch in einem gemeinsamen Batch darf kein Resultat einem neu besetzten Spiel zugeordnet werden.
	for (const match of matches) {
		const before = byNumber.get(match.matchNumber);
		if (match.status === 'Beendet' && (match.teamAId !== before.teamAId || match.teamBId !== before.teamBId)) {
			errors[match.matchNumber] = 'Die Teams dieses Spiels haben sich geändert. Bitte prüfe das Resultat erneut.';
		}
	}
	if (Object.keys(errors).length) return { valid: false, errors };
	const played = matches.filter((match) => match.status === 'Beendet').length;
	const status = played === 0 ? 'Bereit' : played === matches.length && currentRound >= matchdays(matches).length ? 'Abgeschlossen' : 'Läuft';
	return { valid: true, errors: {}, matches, count: changes.size, status };
}

export function tournamentWinner(tournament, teams, matches) {
	if (tournament.status !== 'Abgeschlossen' || !matches.length) return null;
	if (tournament.mode === 'liga') return calculateStandings(teams, matches)[0]?.teamId ?? null;
	return winnerOf(matches.find((match) => match.phase === 'ko' && match.roundName === 'Final'));
}

export function advanceMatchday(matches, teams, currentRound, expectedRound) {
	if (expectedRound !== currentRound) return { valid: false, error: 'Der Spieltag wurde inzwischen gewechselt. Bitte aktualisiere die Seite.' };
	if (!canAdvance(matches, currentRound)) return { valid: false, error: 'Bitte trage zuerst alle Resultate bis zum aktuellen Spieltag ein. Nach dem letzten Spieltag ist kein weiterer Wechsel möglich.' };
	return { valid: true, currentRound: currentRound + 1, matches: resolvePlaces(matches, teams, currentRound + 1) };
}
