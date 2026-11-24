import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTeamName, validateTeam } from '../src/lib/team-rules.js';
import { defaultSchedule, validateSchedule } from '../src/lib/schedule-rules.js';
import { creationStep } from '../src/lib/tournament-steps.js';

const draft = { teamCount: 4, status: 'Entwurf', teamEntry: null };

test('Team-Namen: Grenzen, Leerzeichen und ungültige Eingaben', () => {
	for (const name of ['', ' ', 'a', 'x'.repeat(41), null, 42]) {
		assert.equal(validateTeam({ name }, [], 4).valid, false);
	}
	for (const name of ['ab', 'x'.repeat(40)]) assert.equal(validateTeam({ name }, [], 4).valid, true);
	assert.equal(validateTeam({ name: '  Dino Team  ' }, [], 4).values.name, 'Dino Team');
});

test('Duplikate unabhängig von Grossschreibung und Unicode-Schreibweise', () => {
	const teams = [{ name: 'Dino Team' }, { name: 'Äxte' }];
	for (const name of ['DINO TEAM', '  dino team ', 'A\u0308XTE']) {
		assert.equal(validateTeam({ name }, teams, 4).valid, false);
	}
	assert.equal(normalizeTeamName(' A\u0308XTE '), 'äxte');
	assert.equal(validateTeam({ name: 'Dino Team' }, [], 4).valid, true);
});

test('Teamlimit: letzter freier Platz erlaubt, danach gesperrt', () => {
	const teams = [{ name: 'Team A' }, { name: 'Team B' }];
	assert.equal(validateTeam({ name: 'Team C' }, teams, 3).valid, true);
	assert.equal(validateTeam({ name: 'Team C' }, teams, 2).valid, false);
	assert.equal(validateTeam({ name: 'Team C' }, teams, 1).valid, false);
});

test('Teamvalidierung verändert Eingaben und bestehende Teams nicht', () => {
	const input = Object.freeze({ name: ' Team A ' });
	const teams = Object.freeze([Object.freeze({ name: 'Team B' })]);
	assert.equal(validateTeam(input, teams, 4).valid, true);
	assert.equal(input.name, ' Team A ');
});

test('Ablauf: Standardwerte und gültige Grenzwerte', () => {
	assert.deepEqual(validateSchedule(defaultSchedule), { valid: true, errors: {}, values: defaultSchedule });
	for (const startTime of ['00:00', '09:30', '23:59']) {
		for (const fields of [1, 10, '2']) {
			for (const matchDuration of [5, 120, '15']) {
				assert.equal(validateSchedule({ startTime, fields, matchDuration }).valid, true);
			}
		}
	}
});

test('Ablauf: ungültige Zeiten und Zahlen werden zurückgewiesen', () => {
	for (const startTime of ['', '9:00', '24:00', '09:60', '09:00:00', null]) {
		assert.ok(validateSchedule({ ...defaultSchedule, startTime }).errors.startTime);
	}
	for (const fields of [0, 11, 1.5, '', 'abc', null, true, Infinity]) {
		assert.ok(validateSchedule({ ...defaultSchedule, fields }).errors.fields);
	}
	for (const matchDuration of [4, 121, 5.5, '', null, true, Infinity]) {
		assert.ok(validateSchedule({ ...defaultSchedule, matchDuration }).errors.matchDuration);
	}
});

test('Manueller Weg: Auswahl → Teams → Ablauf → Turnier', () => {
	assert.equal(creationStep(draft, 0), 'teams');
	const manual = { ...draft, teamEntry: 'manuell' };
	assert.equal(creationStep(manual, 0), 'teams/manuell');
	assert.equal(creationStep(manual, 3), 'teams/manuell');
	assert.equal(creationStep(manual, 4), 'ablauf');
	assert.equal(creationStep({ ...manual, ...defaultSchedule }, 4), 'ablauf');
	assert.equal(creationStep({ ...manual, ...defaultSchedule, status: 'Bereit' }, 4), '');
});

test('Code-Weg braucht gültigen sechsstelligen Code, aber noch keine Teams', () => {
	for (const joinCode of [undefined, '', '12345', '1234567', 'abcdef']) {
		assert.equal(creationStep({ ...draft, teamEntry: 'code', joinCode }, 0), 'teams');
	}
	const code = { ...draft, teamEntry: 'code', joinCode: '000123' };
	assert.equal(creationStep(code, 0), 'ablauf');
	assert.equal(creationStep({ ...code, ...defaultSchedule, status: 'Bereit' }, 0), '');
});

test('Unvollständige Turniere können spätere Schritte nicht überspringen', () => {
	assert.equal(creationStep({ ...draft, ...defaultSchedule, status: 'Bereit' }, 0), 'teams');
	assert.equal(creationStep({ ...draft, teamEntry: 'manuell', ...defaultSchedule, status: 'Bereit' }, 3), 'teams/manuell');
	assert.equal(creationStep({ ...draft, teamEntry: 'manuell', status: 'Bereit' }, 4), 'ablauf');
});
