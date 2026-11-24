import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import {
	searchCategory, escapeRegExp, nameFilter, normalizeQuery, parseSearchQuery,
	groupByCategory, pageOf, publicTournament, SEARCH_PAGE_SIZE
} from '../src/lib/tournament-search.js';

const base = { teamEntry: 'code', status: 'Bereit', teamCount: 8, joinCode: '012345' };

test('searchCategory: Entwürfe erscheinen nie', () => {
	for (const entry of ['code', 'manuell', null]) {
		assert.equal(searchCategory({ ...base, teamEntry: entry, status: 'Entwurf' }, 0, false), null);
		assert.equal(searchCategory({ ...base, teamEntry: entry, status: 'Entwurf' }, 8, true), null);
	}
	assert.equal(searchCategory(null, 0, false), null);
	assert.equal(searchCategory(undefined, 0, false), null);
});

test('searchCategory: offen, laufend, abgeschlossen', () => {
	assert.equal(searchCategory(base, 3, false), 'offen');
	assert.equal(searchCategory(base, 0, false), 'offen');
	assert.equal(searchCategory(base, 8, true), 'laufend', 'Bereit mit Spielplan');
	assert.equal(searchCategory({ ...base, status: 'Läuft' }, 8, true), 'laufend');
	assert.equal(searchCategory({ ...base, planCreatedAt: new Date() }, 8, false), 'laufend', 'Spielplan per planCreatedAt');
	assert.equal(searchCategory({ ...base, teamEntry: 'manuell' }, 8, true), 'laufend');
	assert.equal(searchCategory({ ...base, status: 'Abgeschlossen' }, 8, true), 'abgeschlossen');
	assert.equal(searchCategory({ ...base, status: 'Abgeschlossen', teamEntry: 'manuell' }, 8, false), 'abgeschlossen');
});

test('searchCategory: ohne passenden Bereich nicht sichtbar', () => {
	assert.equal(searchCategory(base, 8, false), null, 'voll, aber noch kein Spielplan');
	assert.equal(searchCategory({ ...base, teamEntry: 'manuell' }, 8, false), null, 'manuell ohne Spielplan');
	assert.equal(searchCategory({ ...base, status: 'Läuft' }, 3, false), null, 'Läuft ohne Spielplan');
	assert.equal(searchCategory({ ...base, status: 'Unbekannt' }, 3, true), null);
});

test('Suchtext mit Sonderzeichen wird wörtlich und ohne Fehler behandelt', () => {
	for (const text of ['(', ')', '.', '*', '+', '?', '[', ']', '{', '}', '^', '$', '|', '\\', 'a(b', '.*', '(?=x)']) {
		const filter = nameFilter(text);
		const pattern = new RegExp(filter.name.$regex, filter.name.$options);
		assert.equal(pattern.test(`Cup ${text} 2026`), true, `findet ${text}`);
		assert.equal(filter.name.$options, 'i');
	}
	const dot = new RegExp(nameFilter('.').name.$regex, 'i');
	assert.equal(dot.test('Dino Cup'), false, 'Punkt passt nicht auf beliebige Zeichen');
	const star = new RegExp(nameFilter('Cup*').name.$regex, 'i');
	assert.equal(star.test('Cu'), false);
	assert.equal(star.test('Cup*'), true);
	const paren = new RegExp(nameFilter('Cup (2026)').name.$regex, 'i');
	assert.equal(paren.test('Grosser cup (2026)'), true);
	assert.equal(paren.test('Cup 2026'), false);
	assert.equal(escapeRegExp('a.b*c(d)'), 'a\\.b\\*c\\(d\\)');
});

test('Suchtext: Gross-/Kleinschreibung egal, leer ohne Filter, Länge begrenzt', () => {
	const pattern = new RegExp(nameFilter('DINO').name.$regex, nameFilter('DINO').name.$options);
	assert.equal(pattern.test('Dino Cup'), true);
	assert.deepEqual(nameFilter(''), {});
	assert.deepEqual(nameFilter('   '), {});
	assert.deepEqual(nameFilter(undefined), {});
	assert.deepEqual(nameFilter(['x']), {});
	assert.equal(normalizeQuery('  Dino   Cup  '), 'Dino Cup');
	assert.equal(normalizeQuery('x'.repeat(500)).length, 100);
});

test('Adressparameter werden geprüft', () => {
	const parse = (query) => parseSearchQuery(new URLSearchParams(query));
	assert.deepEqual(parse(''), { q: '', category: 'alle', page: 1 });
	assert.deepEqual(parse('q=Dino&kategorie=laufend&seite=3'), { q: 'Dino', category: 'laufend', page: 3 });
	assert.equal(parse('kategorie=entwurf').category, 'alle');
	for (const seite of ['0', '-2', 'abc', '']) assert.equal(parse(`seite=${seite}`).page, 1);
	assert.equal(parse('seite=999999').page, 500);
});

const id = () => new ObjectId();
const row = (name, extra = {}) => ({ _id: id(), name, mode: 'liga', startTime: '10:00', teamCount: 8, registeredCount: 0,
	hasMatches: false, createdAt: new Date('2026-11-20T10:00:00Z'), ...base, ...extra });

test('Bereiche: Sortierung nach freien Plätzen, Startzeit bzw. neueste zuerst', () => {
	const rows = [
		row('Fast voll', { registeredCount: 7 }),
		row('Leer alt', { createdAt: new Date('2026-11-01T10:00:00Z') }),
		row('Leer neu', { createdAt: new Date('2026-11-22T10:00:00Z') }),
		row('Entwurf', { status: 'Entwurf' }),
		row('Spät', { status: 'Läuft', hasMatches: true, startTime: '15:30' }),
		row('Früh', { status: 'Bereit', hasMatches: true, startTime: '08:00' }),
		row('Ohne Zeit', { status: 'Läuft', hasMatches: true, startTime: null }),
		row('Fertig alt', { status: 'Abgeschlossen', createdAt: new Date('2026-10-01T10:00:00Z') }),
		row('Fertig neu', { status: 'Abgeschlossen', createdAt: new Date('2026-11-23T10:00:00Z') })
	];
	const groups = groupByCategory(rows);
	assert.deepEqual(groups.offen.map((r) => r.name), ['Leer neu', 'Leer alt', 'Fast voll']);
	assert.deepEqual(groups.laufend.map((r) => r.name), ['Früh', 'Spät', 'Ohne Zeit']);
	assert.deepEqual(groups.abgeschlossen.map((r) => r.name), ['Fertig neu', 'Fertig alt']);
	assert.ok(!Object.values(groups).flat().some((r) => r.name === 'Entwurf'));
});

test('Seiten zu je 12 Ergebnissen', () => {
	const items = Array.from({ length: 30 }, (_, i) => i);
	assert.equal(SEARCH_PAGE_SIZE, 12);
	assert.deepEqual(pageOf(items, 1), { items: items.slice(0, 12), page: 1, hasMore: true });
	assert.deepEqual(pageOf(items, 3), { items: items.slice(24, 30), page: 3, hasMore: false });
	assert.deepEqual(pageOf(items.slice(0, 12), 1).hasMore, false);
	assert.deepEqual(pageOf([], 1), { items: [], page: 1, hasMore: false });
});

test('Öffentliche Felder enthalten keinen joinCode und keine Benutzer-IDs', () => {
	const ownerId = new ObjectId(), userId = new ObjectId();
	const raw = row('Dino Cup', { status: 'Abgeschlossen', ownerId, registeredBy: userId, joinCode: '987654', revision: 4 });
	const result = publicTournament(raw, 'abgeschlossen', 'Die Raptoren');
	assert.deepEqual(Object.keys(result).sort(), ['category', 'id', 'mode', 'name', 'registeredCount', 'startTime', 'status', 'teamCount', 'winner']);
	const json = JSON.stringify(result);
	for (const secret of ['987654', 'joinCode', 'ownerId', 'registeredBy', ownerId.toHexString(), userId.toHexString()]) assert.ok(!json.includes(secret), secret);
	assert.equal(result.id, raw._id.toHexString());
	assert.equal(result.winner, 'Die Raptoren');
	assert.equal(publicTournament(raw, 'offen', 'Die Raptoren').winner, null, 'Sieger nur bei Abgeschlossen');
});
