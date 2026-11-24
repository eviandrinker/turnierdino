import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSchedule, roundRobin, groupPairings } from '../src/lib/server/schedule.js';

const teams = (n) => Array.from({ length: n }, (_, i) => ({ id: `team${i}`, name: `Team ${i}` }));
const tournament = (n, extra = {}) => ({ name: 'Dino Cup', mode: 'liga', teamCount: n, startTime: '09:00', fields: 3, matchDuration: 15, ...extra });
const minutes = (match) => match.scheduledDay * 1440 + Number(match.scheduledTime.slice(0, 2)) * 60 + Number(match.scheduledTime.slice(3));
function checkWindows(matches, fields) {
	const windows = new Map();
	for (const match of matches) {
		const time = minutes(match);
		if (!windows.has(time)) windows.set(time, []);
		windows.get(time).push(match);
	}
	for (const games of windows.values()) {
		assert.ok(games.length <= fields);
		assert.equal(new Set(games.map((m) => m.field)).size, games.length);
		assert.ok(games.every((m) => m.field >= 1 && m.field <= fields));
		const ids = games.flatMap((m) => [m.teamAId, m.teamBId]).filter(Boolean);
		assert.equal(new Set(ids).size, ids.length, 'Kein Team zweimal im Zeitfenster');
	}
	for (const match of matches.filter((m) => m.phase === 'ko')) {
		for (const earlier of matches.filter((m) => m.phase !== 'ko' || m.round < match.round)) {
			assert.ok(minutes(earlier) < minutes(match), 'K.-o. erst nach vorheriger Phase/Runde');
		}
	}
}

for (const n of [2, 3, 4, 5, 7, 8, 16, 17]) {
	test(`Liga mit ${n} Teams: alle Paare genau einmal, Runden und Freilose`, () => {
		const rounds = roundRobin(teams(n).map((team) => team.id));
		const pairs = rounds.flat();
		assert.equal(pairs.length, n * (n - 1) / 2);
		assert.equal(new Set(pairs.map((pair) => [...pair].sort().join('|'))).size, pairs.length);
		assert.equal(rounds.length, n % 2 ? n : n - 1);
		for (const round of rounds) assert.equal(new Set(round.flat()).size, n % 2 ? n - 1 : n);
		if (n % 2) for (const team of teams(n)) assert.equal(rounds.filter((round) => !round.flat().includes(team.id)).length, 1);
		for (const fields of [1, 2, 10]) {
			const { matches } = generateSchedule(tournament(n, { fields }), teams(n), 42);
			checkWindows(matches, fields);
			assert.deepEqual(matches.map((m) => m.matchNumber), Array.from({ length: pairs.length }, (_, i) => i + 1));
		}
	});
}

for (const n of [4, 8, 16]) {
	test(`K.-o. mit ${n} Teams: vollständiger Baum und Abhängigkeiten`, () => {
		const { matches } = generateSchedule(tournament(n, { mode: 'ko', fields: 2 }), teams(n), 42);
		assert.equal(matches.length, n - 1);
		assert.equal(matches.at(-1).roundName, 'Final');
		assert.equal(matches.at(-1).round, Math.log2(n));
		assert.equal(new Set(matches.filter((m) => m.round === 1).flatMap((m) => [m.teamAId, m.teamBId])).size, n);
		for (const match of matches.filter((m) => m.round > 1)) {
			assert.equal(match.teamAId, null); assert.equal(match.teamBId, null);
			for (const source of [match.sourceA, match.sourceB]) {
				assert.equal(source.type, 'winner');
				assert.equal(matches[source.matchNumber - 1].round, match.round - 1);
			}
		}
		checkWindows(matches, 2);
	});
}

test('Kreuzvergleich für zwei und vier Gruppen entspricht der Vorgabe', () => {
	const labels = (groups) => groupPairings(groups, 2).map((pair) => pair.map((s) => `${s.group}${s.rank}`).join('–'));
	assert.deepEqual(labels(['A', 'B']), ['A1–B2', 'B1–A2']);
	assert.deepEqual(labels(['A', 'B', 'C', 'D']), ['A1–B2', 'C1–D2', 'B1–A2', 'D1–C2']);
});

for (const [groupCount, qualifiersPerGroup] of [[2, 1], [2, 2], [2, 4], [2, 8], [4, 1], [4, 2], [4, 4], [8, 1], [8, 2], [16, 1]]) {
	test(`Gruppenphase ${groupCount} × ${qualifiersPerGroup}: ausgeglichen, vollständig, zeitlich korrekt`, () => {
		const n = groupCount * Math.max(3, qualifiersPerGroup) + 1;
		const plan = generateSchedule(tournament(n, { mode: 'gruppen_ko', groupCount, qualifiersPerGroup, fields: 4 }), teams(n), 123);
		const sizes = [];
		for (const group of new Set(plan.teams.map((team) => team.group))) {
			const members = plan.teams.filter((team) => team.group === group);
			sizes.push(members.length);
			const games = plan.matches.filter((m) => m.group === group);
			assert.equal(games.length, members.length * (members.length - 1) / 2);
			assert.equal(new Set(games.map((m) => [m.teamAId, m.teamBId].sort().join('|'))).size, games.length);
			assert.ok(games.every((m) => members.some((team) => team.id === m.teamAId) && members.some((team) => team.id === m.teamBId)));
		}
		assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
		assert.equal(plan.matches.filter((m) => m.phase === 'ko').length, groupCount * qualifiersPerGroup - 1);
		const slots = plan.matches.filter((m) => m.phase === 'ko' && m.round === 1).flatMap((m) => [m.sourceA, m.sourceB]);
		assert.equal(new Set(slots.map((s) => `${s.group}:${s.rank}`)).size, slots.length);
		checkWindows(plan.matches, 4);
	});
}

test('Zeitfenster enthalten fünf Minuten Pause und unterscheiden Folgetage', () => {
	const { matches } = generateSchedule(tournament(4, { startTime: '23:50', fields: 1, matchDuration: 15 }), teams(4));
	assert.equal(matches[0].scheduledTime, '23:50');
	assert.equal(matches[1].scheduledTime, '00:10');
	assert.equal(matches[1].scheduledDay, 1);
	for (let i = 1; i < matches.length; i++) assert.equal(minutes(matches[i]) - minutes(matches[i - 1]), 20);
});

test('Planer ist rein, reproduzierbar und prüft fehlende bzw. doppelte Teams', () => {
	const input = teams(8), config = tournament(8, { mode: 'ko' });
	const before = JSON.stringify({ input, config });
	assert.deepEqual(generateSchedule(config, input, 99), generateSchedule(config, input, 99));
	assert.notDeepEqual(generateSchedule(config, input, 99), generateSchedule(config, input, 100));
	assert.equal(JSON.stringify({ input, config }), before);
	assert.throws(() => generateSchedule(config, input.slice(1)));
	assert.throws(() => generateSchedule(config, [...input.slice(1), input[1]]));
	assert.throws(() => generateSchedule({ ...config, fields: 0 }, input));
});
