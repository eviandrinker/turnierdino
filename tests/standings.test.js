import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateStandings } from '../src/lib/standings.js';
const teams = ['A', 'B', 'C', 'D'].map((id) => ({ id, name: id }));
const game = (a, b, x, y, extra = {}) => ({ teamAId: a, teamBId: b, scoreA: x, scoreB: y, phase: 'liga', status: 'Beendet', ...extra });

test('Tabelle berechnet Spiele, S/U/N, Tore, Differenz und Punkte', () => {
	const rows = calculateStandings(teams, [game('A', 'B', 2, 0), game('A', 'C', 1, 1), game('B', 'C', 3, 1)]);
	assert.deepEqual(rows[0], { teamId: 'A', name: 'A', played: 2, wins: 1, draws: 1, losses: 0, goalsFor: 3, goalsAgainst: 1, difference: 2, points: 4, rank: 1 });
	assert.equal(rows.find((row) => row.teamId === 'B').losses, 1);
	assert.equal(rows.find((row) => row.teamId === 'C').points, 1);
	assert.equal(rows.find((row) => row.teamId === 'D').played, 0);
});

test('Sortierung nach Punkten, Differenz und danach erzielten Toren', () => {
	assert.deepEqual(calculateStandings(teams, [game('A', 'C', 2, 0), game('B', 'D', 4, 1)]).map((r) => r.teamId), ['B', 'A', 'C', 'D']);
	assert.deepEqual(calculateStandings(teams, [game('A', 'C', 2, 0), game('B', 'D', 3, 1)]).slice(0, 2).map((r) => r.teamId), ['B', 'A']);
	assert.deepEqual(calculateStandings(teams, []).map((r) => r.teamId), ['A', 'B', 'C', 'D']);
});

test('Offene Spiele, K.-o. und fremde Gruppen zählen nicht; Daten bleiben unverändert', () => {
	const matches = [game('A', 'B', 0, 0), game('A', 'B', null, null, { status: 'Geplant' }), game('A', 'B', 9, 0, { phase: 'ko' }), game('C', 'D', 4, 1)];
	const snapshot = JSON.stringify(matches);
	const rows = calculateStandings(teams.slice(0, 2), matches);
	assert.equal(rows[0].played, 1); assert.equal(rows[0].points, 1);
	assert.equal(JSON.stringify(matches), snapshot);
});
