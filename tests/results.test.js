import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSchedule } from '../src/lib/server/schedule.js';
import { applyResults, tournamentWinner } from '../src/lib/server/results.js';

function plan(mode = 'ko', n = 4, extra = {}) {
	const tournament = { name: 'Dino Cup', mode, teamCount: n, startTime: '09:00', fields: 2, matchDuration: 15, ...extra };
	const teams = Array.from({ length: n }, (_, i) => ({ id: `team${i}`, name: `Team ${i}` }));
	return { tournament, ...generateSchedule(tournament, teams, 42) };
}
const entry = (match, scoreA, scoreB) => ({ matchNumber: match.matchNumber, scoreA, scoreB, expected: { scoreA: match.scoreA, scoreB: match.scoreB, teamAId: match.teamAId, teamBId: match.teamBId } });

test('Tore: 0–99, ganzzahlig, beide ausgefüllt oder beide leer', () => {
	const { matches, teams } = plan('liga');
	for (const [a, b] of [[0, 99], ['0', '0'], ['99', '99'], ['', '']]) assert.equal(applyResults(matches, teams, [entry(matches[0], a, b)]).valid, true);
	for (const [a, b] of [[-1, 0], [100, 0], [1.5, 0], ['abc', '0'], ['1e1', '0'], ['', '1'], ['1', ''], [true, 0]]) {
		assert.ok(applyResults(matches, teams, [entry(matches[0], a, b)]).errors[1]);
	}
});

test('Ungültiger Batch bleibt vollständig unverändert', () => {
	const { matches, teams } = plan('liga');
	const before = JSON.stringify(matches);
	const result = applyResults(matches, teams, [entry(matches[0], 3, 1), entry(matches[1], 100, 0)]);
	assert.equal(result.valid, false); assert.ok(result.errors[2]);
	assert.equal(JSON.stringify(matches), before);
	assert.equal(applyResults(matches, teams, [{ matchNumber: 999, scoreA: 1, scoreB: 0 }]).valid, false);
	assert.equal(applyResults(matches, teams, [entry(matches[0], 1, 0), entry(matches[0], 1, 0)]).valid, false);
});

test('K.-o.: kein Unentschieden und keine Eingabe bei offenen Teams', () => {
	const { matches, teams } = plan();
	assert.equal(applyResults(matches, teams, [entry(matches[0], 1, 1)]).errors[1], 'Im K.-o. braucht es einen Sieger');
	assert.ok(applyResults(matches, teams, [entry(matches[2], 2, 0)]).errors[3]);
});

for (const n of [4, 8, 16]) {
	test(`K.-o. ${n}: Sieger rücken Runde für Runde vor, Final bestimmt Turniersieger`, () => {
		const initial = plan('ko', n);
		let matches = initial.matches, result;
		for (let round = 1; round <= Math.log2(n); round++) {
			const games = matches.filter((match) => match.round === round);
			assert.ok(games.every((match) => match.teamAId && match.teamBId));
			result = applyResults(matches, initial.teams, games.map((match) => entry(match, 2, 1)));
			assert.equal(result.valid, true); assert.equal(result.count, games.length);
			matches = result.matches;
			assert.equal(result.status, round === Math.log2(n) ? 'Abgeschlossen' : 'Läuft');
		}
		assert.equal(tournamentWinner({ ...initial.tournament, status: result.status }, initial.teams, matches), matches.at(-1).teamAId);
	});
}

test('Korrektur ändert ungepielten Folgeplatz; gespielte Abhängigkeiten sperren jede Korrektur', () => {
	const { matches, teams } = plan();
	const semis = applyResults(matches, teams, matches.slice(0, 2).map((match) => entry(match, 2, 0)));
	const corrected = applyResults(semis.matches, teams, [entry(semis.matches[0], 0, 3)]);
	assert.equal(corrected.valid, true);
	assert.equal(corrected.matches[2].teamAId, matches[0].teamBId);
	const final = applyResults(semis.matches, teams, [entry(semis.matches[2], 4, 0)]);
	for (const [a, b] of [[0, 3], [3, 0], ['', '']]) {
		const locked = applyResults(final.matches, teams, [entry(final.matches[0], a, b)]);
		assert.match(locked.errors[1], /Korrektur gesperrt/);
	}
	const correctedFinal = applyResults(final.matches, teams, [entry(final.matches[2], 0, 1)]);
	assert.equal(correctedFinal.valid, true);
	assert.equal(correctedFinal.status, 'Abgeschlossen');
});

test('Abhängigkeitssperre wirkt über mehrere K.-o.-Runden', () => {
	const { matches, teams } = plan('ko', 8);
	const first = applyResults(matches, teams, matches.filter((m) => m.round === 1).map((m) => entry(m, 2, 0)));
	const semis = applyResults(first.matches, teams, first.matches.filter((m) => m.round === 2).map((m) => entry(m, 2, 0)));
	const final = applyResults(semis.matches, teams, [entry(semis.matches.at(-1), 1, 0)]);
	assert.match(applyResults(final.matches, teams, [entry(final.matches[0], 3, 0)]).errors[1], /Korrektur gesperrt/);
});

test('Löschen eines Resultats leert Folgeplatz und setzt Status zurück', () => {
	const { matches, teams } = plan();
	const first = applyResults(matches, teams, [entry(matches[0], 2, 0)]);
	const cleared = applyResults(first.matches, teams, [entry(first.matches[0], '', '')]);
	assert.equal(cleared.valid, true); assert.equal(cleared.status, 'Bereit');
	assert.equal(cleared.matches[2].teamAId, null);
	assert.equal(cleared.matches[0].scoreA, null);
});

test('Gruppenplätze erst nach allen Gruppenspielen, danach Kreuzvergleich aus Tabellen', () => {
	const initial = plan('gruppen_ko', 8, { groupCount: 2, qualifiersPerGroup: 2 });
	const groupGames = initial.matches.filter((m) => m.phase === 'gruppe');
	const first = applyResults(initial.matches, initial.teams, groupGames.slice(0, -1).map((m) => entry(m, 0, 0)));
	assert.equal(first.valid, true);
	assert.ok(first.matches.filter((m) => m.phase === 'ko').every((m) => m.teamAId === null && m.teamBId === null));
	const last = first.matches.find((m) => m.matchNumber === groupGames.at(-1).matchNumber);
	const done = applyResults(first.matches, initial.teams, [entry(last, 0, 0)]);
	const semis = done.matches.filter((m) => m.phase === 'ko' && m.round === 1);
	const a = initial.teams.filter((team) => team.group === 'A'), b = initial.teams.filter((team) => team.group === 'B');
	assert.deepEqual([semis[0].teamAId, semis[0].teamBId, semis[1].teamAId, semis[1].teamBId], [a[0].id, b[1].id, b[0].id, a[1].id]);
	const played = applyResults(done.matches, initial.teams, [entry(semis[0], 1, 0)]);
	assert.equal(played.valid, true);
	const blocked = applyResults(played.matches, initial.teams, [entry(played.matches[0], 3, 0)]);
	assert.match(blocked.errors[1], /Korrektur gesperrt/);
});

test('Gruppenkorrektur aktualisiert noch offene K.-o.-Plätze', () => {
	const initial = plan('gruppen_ko', 6, { groupCount: 2, qualifiersPerGroup: 1 });
	const played = applyResults(initial.matches, initial.teams, initial.matches.filter((m) => m.phase === 'gruppe').map((m) => entry(m, 0, 0)));
	const group = initial.teams.filter((team) => team.group === 'A');
	const target = played.matches.find((m) => m.phase === 'gruppe' && m.group === 'A' && [m.teamAId, m.teamBId].includes(group[2].id));
	const corrected = applyResults(played.matches, initial.teams, [entry(target, target.teamAId === group[2].id ? 4 : 0, target.teamBId === group[2].id ? 4 : 0)]);
	assert.equal(corrected.valid, true);
	assert.equal(corrected.matches.at(-1).teamAId, group[2].id);
});

test('Veraltete Resultate und geänderte Teilnehmer werden nicht überschrieben', () => {
	const { matches, teams } = plan();
	const oldEntry = entry(matches[0], 3, 0);
	const current = applyResults(matches, teams, [entry(matches[0], 1, 0)]);
	assert.match(applyResults(current.matches, teams, [oldEntry]).errors[1], /inzwischen geändert/);
	const semis = applyResults(matches, teams, matches.slice(0, 2).map((m) => entry(m, 2, 0)));
	const oldFinal = entry(semis.matches[2], 3, 0);
	const switched = applyResults(semis.matches, teams, [entry(semis.matches[0], 0, 2)]);
	assert.match(applyResults(switched.matches, teams, [oldFinal]).errors[3], /inzwischen geändert/);
});

test('Batch darf keine Korrektur plus bereits abhängiges neues Resultat kombinieren', () => {
	const { matches, teams } = plan();
	const semis = applyResults(matches, teams, matches.slice(0, 2).map((m) => entry(m, 2, 0)));
	const result = applyResults(semis.matches, teams, [entry(semis.matches[0], 0, 3), entry(semis.matches[2], 2, 0)]);
	assert.equal(result.valid, false);
});

test('Liga: Status, unveränderte Ergebnisse zählen nicht, Sieger aus Tabelle', () => {
	const { matches, teams, tournament } = plan('liga', 3);
	const partial = applyResults(matches, teams, [entry(matches[0], 1, 0)]);
	assert.equal(partial.status, 'Läuft');
	const unchanged = applyResults(partial.matches, teams, [entry(partial.matches[0], '1', '0')]);
	assert.equal(unchanged.count, 0);
	const all = applyResults(matches, teams, matches.map((m) => entry(m, m.teamAId === 'team0' ? 3 : 0, m.teamBId === 'team0' ? 3 : 0)));
	assert.equal(all.status, 'Abgeschlossen');
	assert.equal(tournamentWinner({ ...tournament, status: all.status }, teams, all.matches), 'team0');
	assert.equal(tournamentWinner({ ...tournament, status: 'Läuft' }, teams, partial.matches), null);
});
