import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchdays, canAdvance, currentMatchday } from '../src/lib/matchdays.js';
import { generateSchedule } from '../src/lib/server/schedule.js';
import { advanceMatchday, applyResults } from '../src/lib/server/results.js';
import { validateResult, resultVersion } from '../src/lib/result-rules.js';

function plan(mode, count, extra = {}) {
	const teams = Array.from({ length: count }, (_, i) => ({ id: `t${i}`, name: `Team ${i}` }));
	return generateSchedule({ name: 'Dino Cup', mode, teamCount: count, startTime: '09:00', fields: 2, matchDuration: 15, ...extra }, teams, 42);
}
const entries = (games, a = 2, b = 0) => games.map((m) => ({ matchNumber: m.matchNumber, scoreA: a, scoreB: b, expected: resultVersion(m) }));

for (const count of [4, 5]) test(`Liga ${count}: genau ein Spieltag pro Kreismethoden-Runde`, () => {
	const { matches } = plan('liga', count);
	const days = matchdays([...matches].reverse());
	assert.equal(days.length, count % 2 ? count : count - 1);
	for (const day of days) {
		assert.equal(day.label, `Spieltag ${day.number}`);
		assert.ok(day.matches.every((m) => m.round === day.number));
		assert.equal(day.matches.length, Math.floor(count / 2));
	}
});

test('Gruppenrunden vereinen alle Gruppen, K.-o. wird anschliessend weitergezählt', () => {
	const { matches } = plan('gruppen_ko', 16, { groupCount: 4, qualifiersPerGroup: 2 });
	const days = matchdays(matches);
	assert.deepEqual(days.map((d) => d.label), ['Gruppen 1', 'Gruppen 2', 'Gruppen 3', 'Viertelfinal', 'Halbfinal', 'Final']);
	for (const day of days.slice(0, 3)) assert.deepEqual([...new Set(day.matches.map((m) => m.group))].sort(), ['A', 'B', 'C', 'D']);
	assert.deepEqual(days.map((d) => d.number), [1, 2, 3, 4, 5, 6]);
});

for (const count of [4, 8, 16]) test(`Nur K.-o. ${count}: ein Spieltag je K.-o.-Runde`, () => {
	const days = matchdays(plan('ko', count).matches);
	assert.equal(days.length, Math.log2(count));
	assert.equal(days.at(-1).label, 'Final');
	for (const day of days) assert.equal(day.matches.length, count / 2 ** day.number);
});

test('Nächster Spieltag nur bei vollständigem aktuellen und allen früheren Spieltagen', () => {
	const { matches, teams } = plan('liga', 4);
	assert.equal(canAdvance(matches, 1), false);
	assert.equal(advanceMatchday(matches, teams, 1, 1).valid, false);
	const day = matchdays(matches)[0];
	const partial = applyResults(matches, teams, entries(day.matches.slice(0, 1)), { currentRound: 1 });
	assert.equal(canAdvance(partial.matches, 1), false);
	const done = applyResults(matches, teams, entries(day.matches), { currentRound: 1 });
	assert.equal(canAdvance(done.matches, 1), true);
	assert.equal(advanceMatchday(done.matches, teams, 1, 1).currentRound, 2);
	assert.equal(advanceMatchday(done.matches, teams, 2, 1).valid, false, 'Doppelter/veralteter Wechsel ist gesperrt');
	const all = matches.map((m) => ({ ...m, status: 'Beendet', scoreA: 1, scoreB: 0 }));
	all[0] = { ...all[0], status: 'Geplant', scoreA: null, scoreB: null };
	assert.equal(canAdvance(all, 2), false, 'Gelöschtes früheres Resultat sperrt weiteren Wechsel');
	for (const round of [0, -1, 1.5, 3, 99, NaN]) assert.equal(canAdvance(done.matches, round), false);
	assert.equal(canAdvance([], 1), false);
});

test('Zukünftige Resultate werden serverseitig abgelehnt', () => {
	const { matches, teams } = plan('liga', 4);
	const future = matchdays(matches)[1].matches[0];
	const result = applyResults(matches, teams, entries([future]), { currentRound: 1 });
	assert.equal(result.valid, false);
	assert.match(result.errors[future.matchNumber], /Wird freigeschaltet/);
});

test('K.-o.-Paarungen stehen erst beim Weiterwechsel fest; Finale schliesst ab', () => {
	const { matches, teams } = plan('ko', 4);
	const done = applyResults(matches, teams, entries(matchdays(matches)[0].matches), { currentRound: 1 });
	assert.equal(done.status, 'Läuft');
	assert.equal(done.matches.at(-1).teamAId, null);
	assert.equal(done.matches.at(-1).teamBId, null);
	const advanced = advanceMatchday(done.matches, teams, 1, 1);
	assert.equal(advanced.valid, true);
	assert.ok(advanced.matches.at(-1).teamAId);
	assert.ok(advanced.matches.at(-1).teamBId);
	const final = applyResults(advanced.matches, teams, entries([advanced.matches.at(-1)]), { currentRound: 2 });
	assert.equal(final.status, 'Abgeschlossen');
	assert.equal(advanceMatchday(final.matches, teams, 2, 2).valid, false);
});

test('Gruppenqualifikationen nach letztem Gruppenspieltag, Eingabe erst nach Wechsel', () => {
	const initial = plan('gruppen_ko', 8, { groupCount: 2, qualifiersPerGroup: 2 });
	let matches = initial.matches;
	for (let round = 1; round <= 3; round++) {
		const result = applyResults(matches, initial.teams, entries(matchdays(matches)[round - 1].matches, 0, 0), { currentRound: round });
		assert.equal(result.valid, true);
		matches = result.matches;
		if (round < 3) {
			assert.equal(matches.find((m) => m.phase === 'ko').teamAId, null);
			matches = advanceMatchday(matches, initial.teams, round, round).matches;
		}
	}
	const semi = matches.find((m) => m.phase === 'ko');
	assert.ok(semi.teamAId && semi.teamBId);
	assert.equal(applyResults(matches, initial.teams, entries([semi]), { currentRound: 3 }).valid, false);
	const advanced = advanceMatchday(matches, initial.teams, 3, 3);
	assert.equal(applyResults(advanced.matches, initial.teams, entries([semi]), { currentRound: 4 }).valid, true);
});

test('Bestehende Turniere ohne currentRound starten bei der ersten offenen Runde', () => {
	const { matches } = plan('liga', 4);
	assert.equal(currentMatchday({}, matches), 1);
	const played = matches.map((m) => ({ ...m, status: m.round === 1 ? 'Beendet' : m.status }));
	assert.equal(currentMatchday({}, played), 2);
	assert.equal(currentMatchday({ currentRound: 1 }, played), 1);
	assert.equal(currentMatchday({}, matches.map((m) => ({ ...m, status: 'Beendet' }))), 3);
});

test('Gemeinsame Resultatvalidierung: Grenzen, unvollständig, Löschen, K.-o.-Unentschieden', () => {
	for (const [scoreA, scoreB] of [[0, 99], ['99', '0'], ['', ''], [null, null]]) assert.equal(validateResult({ scoreA, scoreB }, 'ko').valid, true);
	for (const scoreA of [-1, 100, 1.5, '1e1', 'abc', true, undefined]) assert.equal(validateResult({ scoreA, scoreB: 0 }, 'liga').valid, false);
	for (const pair of [{ scoreA: '', scoreB: '1' }, { scoreA: '1', scoreB: '' }]) assert.equal(validateResult(pair, 'liga').incomplete, true);
	assert.equal(validateResult({ scoreA: '', scoreB: '' }, 'ko').values.status, 'Geplant');
	assert.equal(validateResult({ scoreA: 1, scoreB: 1 }, 'liga').valid, true);
	assert.equal(validateResult({ scoreA: 1, scoreB: 1 }, 'ko').error, 'Im K.-o. braucht es einen Sieger');
});
