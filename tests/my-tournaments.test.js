import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { tournamentList, tournamentDestination } from '../src/lib/tournament-list.js';
import { teamSuggestions, selectTeamImports } from '../src/lib/team-suggestions.js';
import { deleteTournamentRecords } from '../src/lib/server/tournament-records.js';

const tournament = (id, status, day) => ({ id, status, createdAt: new Date(`2026-11-${day}T10:00:00Z`) });
const list = [tournament('d1', 'Entwurf', '23'), tournament('a1', 'Abgeschlossen', '24'), tournament('b1', 'Bereit', '24'), tournament('l1', 'Läuft', '10'), tournament('l2', 'Läuft', '20'), tournament('d2', 'Entwurf', '24')];

test('Turnierliste: Statusreihenfolge und innerhalb jedes Status neueste zuerst', () => {
	const snapshot = JSON.stringify(list);
	assert.deepEqual(tournamentList(list).items.map((t) => t.id), ['l2', 'l1', 'b1', 'd2', 'd1', 'a1']);
	assert.equal(JSON.stringify(list), snapshot);
});

test('Filter zählen unabhängig vom aktiven Filter; Laufend umfasst Läuft und Bereit', () => {
	assert.deepEqual(tournamentList(list).counts, { all: 6, running: 3, drafts: 2, completed: 1 });
	for (const [key, ids] of [['running', ['l2', 'l1', 'b1']], ['drafts', ['d2', 'd1']], ['completed', ['a1']]]) {
		const result = tournamentList(list, key);
		assert.deepEqual(result.items.map((t) => t.id), ids);
		assert.deepEqual(result.counts, tournamentList(list).counts);
	}
	assert.equal(tournamentList(list, 'invalid').selected, 'all');
	assert.deepEqual(tournamentList([], 'drafts').items, []);
	assert.equal(tournamentList([]).counts.all, 0);
});

test('Entwurf öffnet direkt den fehlenden Erstellungsschritt', () => {
	const draft = { id: 'dino', status: 'Entwurf', teamCount: 4 };
	assert.equal(tournamentDestination(draft, 0), '/turnier/dino/teams');
	assert.equal(tournamentDestination({ ...draft, teamEntry: 'manuell' }, 2), '/turnier/dino/teams/manuell');
	assert.equal(tournamentDestination({ ...draft, teamEntry: 'manuell' }, 4), '/turnier/dino/ablauf');
	assert.equal(tournamentDestination({ ...draft, teamEntry: 'code', joinCode: '012345' }, 0), '/turnier/dino/ablauf');
	for (const status of ['Bereit', 'Läuft', 'Abgeschlossen']) assert.equal(tournamentDestination({ ...draft, status }, 0), '/turnier/dino');
});

const history = [{ id: 'current', ownerId: 'owner' }, { id: 'old1', ownerId: 'owner' }, { id: 'old2', ownerId: 'owner' }, { id: 'foreign', ownerId: 'someone-else' }];
const team = (tournamentId, name, day) => ({ tournamentId, name, createdAt: new Date(`2026-11-${day}T10:00:00Z`) });

test('Team-Vorschläge fassen Gross-/Kleinschreibung und Unicode zusammen, neueste Schreibweise gewinnt', () => {
	const teams = [team('old1', 'Dinos', '10'), team('old2', ' DINOS ', '20'), team('old1', 'Äxte', '11'), team('old2', 'A\u0308XTE', '21')];
	const result = teamSuggestions('owner', 'current', history, teams);
	assert.deepEqual(result.map((item) => [item.name, item.frequency]), [['ÄXTE', 2], ['DINOS', 2]]);
});

test('Häufigkeit vor letzter Verwendung; mehrfacher Name im selben Turnier zählt nur einmal', () => {
	const teams = [team('old1', 'Dinos', '10'), team('old1', 'DINOS', '11'), team('old2', 'Dinos', '12'), team('old1', 'Wölfe', '24'), team('old1', 'Füchse', '23')];
	const result = teamSuggestions('owner', 'current', history, teams);
	assert.deepEqual(result.map((item) => [item.name, item.frequency]), [['Dinos', 2], ['Wölfe', 1], ['Füchse', 1]]);
});

test('Nur eigene andere Turniere; bereits erfasste Namen und verwaiste Teams werden ausgeblendet', () => {
	const teams = [team('old1', 'Dinos', '10'), team('current', 'DINOS', '24'), team('foreign', 'Geheimes Team', '24'), team('orphan', 'Verwaistes Team', '24'), team('current', 'Neues Team', '24'), team('old2', 'Wölfe', '20')];
	assert.deepEqual(teamSuggestions('owner', 'current', history, teams).map((s) => s.name), ['Wölfe']);
	assert.deepEqual(teamSuggestions('unbekannt', 'current', history, teams), []);
});

test('Maximal 20 Vorschläge, Eingaben bleiben unverändert', () => {
	const teams = Array.from({ length: 25 }, (_, i) => team('old1', `Team ${String(i).padStart(2, '0')}`, '20'));
	const snapshot = JSON.stringify(teams);
	const result = teamSuggestions('owner', 'current', history, teams);
	assert.equal(result.length, 20);
	assert.equal(result[0].name, 'Team 00');
	assert.equal(JSON.stringify(teams), snapshot);
});

test('Teamübernahme überspringt Duplikate/ungültige Namen und hält das Limit ein', () => {
	const current = [{ name: 'Dinos' }];
	const source = [{ name: 'dinos' }, { name: 'x' }, { name: ' Wölfe ' }, { name: 'WÖLFE' }, { name: 'Füchse' }, { name: 'Bären' }];
	assert.deepEqual(selectTeamImports(source, current, 3), [{ name: 'Wölfe' }, { name: 'Füchse' }]);
	assert.deepEqual(selectTeamImports(source, current, 1), []);
	assert.deepEqual(selectTeamImports([], current, 4), []);
	assert.deepEqual(current, [{ name: 'Dinos' }]);
});

function deletionFixture() {
	const ownerId = new ObjectId(), id = new ObjectId(), otherId = new ObjectId();
	const tournament = { _id: id, ownerId };
	const stores = {
		tournaments: [tournament, { _id: otherId, ownerId }],
		teams: [{ tournamentId: id }, { tournamentId: id }, { tournamentId: otherId }],
		matches: [{ tournamentId: id }, { tournamentId: otherId }]
	};
	const calls = [], session = {};
	const remove = (name, query, options) => {
		assert.equal(options.session, session);
		calls.push(name);
		stores[name] = stores[name].filter((row) => !Object.entries(query).every(([key, value]) => String(row[key]) === String(value)));
	};
	const db = { collection: (name) => ({ deleteMany: async (query, options) => remove(name, query, options), deleteOne: async (query, options) => remove(name, query, options) }) };
	return { owner: { id: ownerId.toHexString() }, tournament, stores, calls, db, session, otherId };
}

test('Löschen entfernt Turnier, Teams und Spiele des Besitzers, keine anderen Daten', async () => {
	const f = deletionFixture();
	await deleteTournamentRecords(f.db, f.session, f.tournament, f.owner);
	assert.deepEqual(f.calls, ['teams', 'matches', 'tournaments']);
	for (const rows of Object.values(f.stores)) assert.equal(rows.length, 1);
	assert.equal(String(f.stores.tournaments[0]._id), String(f.otherId));
	assert.equal(String(f.stores.teams[0].tournamentId), String(f.otherId));
});

test('Fremde, nicht angemeldete Benutzer und Turniere ohne Besitzer lösen keine Löschung aus', async () => {
	for (const [user, ownerless, status] of [[null, false, 401], [{ id: new ObjectId().toHexString() }, false, 403], ['owner', true, 403]]) {
		const f = deletionFixture();
		if (ownerless) delete f.tournament.ownerId;
		await assert.rejects(deleteTournamentRecords(f.db, f.session, f.tournament, user === 'owner' ? f.owner : user), (error) => error.status === status);
		assert.deepEqual(f.calls, []);
		assert.equal(f.stores.teams.length, 3);
		assert.equal(f.stores.matches.length, 2);
		assert.equal(f.stores.tournaments.length, 2);
	}
});
