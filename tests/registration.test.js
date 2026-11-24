import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { isOpenForRegistration, registrationClosedMessage, validateTeamRegistration, openTournamentList } from '../src/lib/registration-rules.js';

const open = { teamEntry: 'code', status: 'Bereit', teamCount: 8, joinCode: '012345' };
const userId = new ObjectId().toHexString();
const teams = (count, registeredBy = () => null) => Array.from({ length: count }, (_, i) => ({ name: `Team ${i + 1}`, registeredBy: registeredBy(i) }));

test('isOpenForRegistration: offen nur mit Code, Status Bereit, ohne Spielplan und mit freiem Platz', () => {
	assert.equal(isOpenForRegistration(open, 0, false), true);
	assert.equal(isOpenForRegistration(open, 7, false), true);
	assert.equal(isOpenForRegistration(open, 8, false), false, 'voll');
	assert.equal(isOpenForRegistration(open, 9, false), false, 'überbucht');
	assert.equal(isOpenForRegistration(open, 3, true), false, 'Spiele vorhanden');
	assert.equal(isOpenForRegistration({ ...open, planCreatedAt: new Date() }, 3, false), false, 'Spielplan erstellt');
	assert.equal(isOpenForRegistration({ ...open, teamEntry: 'manuell' }, 3, false), false, 'manuelle Erfassung');
	assert.equal(isOpenForRegistration({ ...open, teamEntry: null }, 3, false), false);
	for (const status of ['Entwurf', 'Läuft', 'Abgeschlossen']) assert.equal(isOpenForRegistration({ ...open, status }, 3, false), false, status);
	assert.equal(isOpenForRegistration(null, 0, false), false);
	assert.equal(isOpenForRegistration(undefined, 0, false), false);
	assert.equal(isOpenForRegistration(open, -1, false), false);
	assert.equal(isOpenForRegistration(open, 2.5, false), false);
	assert.equal(isOpenForRegistration(open, '3', false), false);
});

test('Passende Meldung für geschlossene Turniere', () => {
	assert.equal(registrationClosedMessage(open, 3, false), '');
	assert.equal(registrationClosedMessage(open, 3, true), 'Dieses Turnier hat schon begonnen');
	assert.equal(registrationClosedMessage({ ...open, planCreatedAt: new Date() }, 3, false), 'Dieses Turnier hat schon begonnen');
	assert.equal(registrationClosedMessage({ ...open, status: 'Läuft' }, 3, false), 'Dieses Turnier hat schon begonnen');
	assert.equal(registrationClosedMessage({ ...open, status: 'Abgeschlossen' }, 8, false), 'Dieses Turnier hat schon begonnen');
	assert.equal(registrationClosedMessage(open, 8, false), 'Alle Plätze sind vergeben');
	assert.equal(registrationClosedMessage({ ...open, teamEntry: 'manuell' }, 3, false), 'Dieses Turnier nimmt keine Anmeldungen an');
	assert.equal(registrationClosedMessage({ ...open, status: 'Entwurf' }, 0, false), 'Dieses Turnier nimmt keine Anmeldungen an');
});

test('Anmeldung: gültiges Team wird akzeptiert und getrimmt', () => {
	const result = validateTeamRegistration(open, teams(3), false, userId, { name: '  Dino Kickers ' });
	assert.equal(result.valid, true);
	assert.equal(result.values.name, 'Dino Kickers');
});

test('Kein zweites Team pro Benutzer (auch mit ObjectId als registeredBy)', () => {
	const existing = teams(3, (i) => i === 1 ? new ObjectId(userId) : null);
	const result = validateTeamRegistration(open, existing, false, userId, { name: 'Zweites Team' });
	assert.equal(result.valid, false);
	assert.equal(result.message, 'Du hast bereits ein Team in diesem Turnier angemeldet.');
	const other = validateTeamRegistration(open, existing, false, new ObjectId().toHexString(), { name: 'Zweites Team' });
	assert.equal(other.valid, true);
});

test('Kein Beitritt bei vollem oder gestartetem Turnier', () => {
	assert.equal(validateTeamRegistration(open, teams(8), false, userId, { name: 'Letzter Platz' }).message, 'Alle Plätze sind vergeben');
	assert.equal(validateTeamRegistration(open, teams(3), true, userId, { name: 'Zu spät' }).message, 'Dieses Turnier hat schon begonnen');
	assert.equal(validateTeamRegistration({ ...open, status: 'Läuft' }, teams(3), false, userId, { name: 'Zu spät' }).valid, false);
	assert.equal(validateTeamRegistration(open, teams(3), false, '', { name: 'Anonym' }).valid, false);
});

test('Teamname: 2–40 Zeichen und keine Duplikate', () => {
	assert.equal(validateTeamRegistration(open, teams(3), false, userId, { name: 'A' }).errors.name, 'Bitte gib einen Team-Namen mit 2–40 Zeichen ein.');
	assert.equal(validateTeamRegistration(open, teams(3), false, userId, { name: 'x'.repeat(41) }).valid, false);
	assert.equal(validateTeamRegistration(open, teams(3), false, userId, { name: ' team 2 ' }).errors.name, 'Ein Team mit diesem Namen ist bereits erfasst.');
});

const row = (id, registeredCount, teamCount, day, extra = {}) => ({
	_id: new ObjectId(id.padStart(24, '0')), name: `Turnier ${id}`, mode: 'liga', startTime: '10:00',
	teamCount, registeredCount, createdAt: new Date(`2026-11-${day}T10:00:00Z`),
	teamEntry: 'code', status: 'Bereit', joinCode: '654321', ownerId: new ObjectId(), hasMatches: false, ...extra
});

test('Öffentliche Liste liefert keinen joinCode und keine Benutzer-IDs', () => {
	const result = openTournamentList([row('1', 2, 8, '20')]);
	assert.deepEqual(Object.keys(result[0]).sort(), ['id', 'mode', 'name', 'registeredCount', 'startTime', 'teamCount']);
	const json = JSON.stringify(result);
	assert.ok(!json.includes('654321'));
	assert.ok(!json.includes('joinCode'));
	assert.ok(!json.includes('ownerId'));
	assert.equal(result[0].id, '1'.padStart(24, '0'));
});

test('Öffentliche Liste: nur offene Turniere, sortiert nach freien Plätzen, dann neueste, max. 50', () => {
	const rows = [
		row('1', 7, 8, '20'), row('2', 0, 8, '10'), row('3', 0, 8, '22'), row('4', 8, 8, '23'),
		row('5', 0, 8, '23', { teamEntry: 'manuell' }), row('6', 0, 8, '23', { hasMatches: true }), row('7', 0, 8, '23', { status: 'Entwurf' })
	];
	assert.deepEqual(openTournamentList(rows).map((t) => t.name), ['Turnier 3', 'Turnier 2', 'Turnier 1']);
	const many = Array.from({ length: 60 }, (_, i) => row(String(i + 10), 0, 4, '20'));
	assert.equal(openTournamentList(many).length, 50);
	assert.deepEqual(openTournamentList([]), []);
});
