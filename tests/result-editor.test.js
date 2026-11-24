import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createResultEditor } from '../src/lib/result-editor.js';
import { calculateStandings } from '../src/lib/standings.js';
import { validateResult } from '../src/lib/result-rules.js';

const turn = () => new Promise((resolve) => setImmediate(resolve));
function harness(phase = 'liga') {
	let match = { id: 'm1', teamAId: 'a', teamBId: 'b', phase, scoreA: null, scoreB: null, status: 'Geplant' };
	let states = {}, now = 0, sequence = 0;
	const timers = new Map(), requests = [];
	const editor = createResultEditor({
		getMatch: () => match,
		onState: (next) => { states = next; },
		onSaved: (reply) => { match = reply.matches[0]; },
		save: (id, input) => new Promise((resolve, reject) => { requests.push({ id, input, resolve, reject }); }),
		delay: (callback, ms) => { const id = ++sequence; timers.set(id, { callback, time: now + ms }); return id; },
		cancelDelay: (id) => timers.delete(id)
	});
	return {
		editor, requests,
		get state() { return states.m1; },
		get match() { return match; },
		remote(patch) { match = { ...match, ...patch }; editor.sync(); },
		async advance(ms) {
			now += ms;
			for (const [id, timer] of timers) if (timer.time <= now) { timers.delete(id); timer.callback(); }
			await turn();
		},
		async succeed(index) {
			const request = requests[index];
			request.resolve({ matches: [{ ...match, ...validateResult(request.input, phase).values }] });
			await turn();
		},
		async fail(index) { requests[index].reject(new Error('Speichern fehlgeschlagen')); await turn(); }
	};
}

test('Fokussiertes Feld bleibt auch ohne Änderung stabil; nach Blur folgt der Serverstand', () => {
	const h = harness();
	h.editor.focus('m1');
	h.remote({ scoreA: 4, scoreB: 2, status: 'Beendet' });
	assert.equal(h.state.a, ''); assert.equal(h.state.expected.scoreA, null);
	h.editor.blur('m1', { retainFocus: true });
	assert.equal(h.state.focused, true); assert.equal(h.state.a, '');
	h.editor.blur('m1');
	assert.equal(h.state.a, '4'); assert.equal(h.state.b, '2');
	assert.equal(h.requests.length, 0);
	h.editor.dispose();
});

test('Unvollständige und gültige ungespeicherte Eingaben überleben Live-Nachladen', async () => {
	const h = harness();
	h.editor.edit('m1', 'a', '3');
	h.remote({ scoreA: 1, scoreB: 0, status: 'Beendet' });
	assert.equal(h.state.a, '3'); assert.equal(h.state.b, '');
	assert.equal(h.state.status, 'incomplete');
	await h.advance(1000); assert.equal(h.requests.length, 0);
	h.editor.edit('m1', 'b', '2');
	h.remote({ scoreA: 5, scoreB: 0 });
	assert.equal(h.state.a, '3'); assert.equal(h.state.b, '2');
	assert.equal(h.state.expected.scoreA, null, 'Ursprüngliche Version für Konfliktprüfung erhalten');
	h.editor.dispose();
});

test('Debounce wartet 600 ms nach der letzten Änderung; Blur speichert sofort', async () => {
	const h = harness();
	h.editor.edit('m1', 'a', '1'); h.editor.edit('m1', 'b', '0');
	await h.advance(500); assert.equal(h.requests.length, 0);
	h.editor.edit('m1', 'a', '2');
	await h.advance(599); assert.equal(h.requests.length, 0);
	await h.advance(1); assert.equal(h.requests.length, 1);
	await h.succeed(0);
	h.editor.edit('m1', 'a', '3'); h.editor.blur('m1');
	assert.equal(h.requests.length, 2);
	await h.succeed(1); h.editor.dispose();
});

test('Laufender Request wird durch Nachladen nicht überschrieben; weitere Eingaben werden seriell gespeichert', async () => {
	const h = harness();
	h.editor.edit('m1', 'a', '1'); h.editor.edit('m1', 'b', '0');
	const first = h.editor.flush('m1');
	assert.equal(h.state.inFlight, true);
	h.remote({ scoreA: 8, scoreB: 8, status: 'Beendet' });
	assert.equal(h.state.a, '1'); assert.equal(h.state.b, '0');
	h.editor.edit('m1', 'a', '3');
	await h.advance(600);
	assert.equal(h.requests.length, 1, 'Keine parallelen Requests desselben Spiels');
	await h.succeed(0); await first;
	assert.equal(h.requests.length, 2);
	assert.equal(h.requests[1].input.scoreA, 3);
	assert.equal(h.requests[1].input.expected.scoreA, 1, 'Nachfolgender Request baut auf bestätigtem Resultat auf');
	assert.equal(h.state.a, '3');
	await h.succeed(1);
	assert.equal(h.state.dirty, false); assert.equal(h.state.inFlight, false);
	assert.equal(h.state.status, 'saved'); h.editor.dispose();
});

test('Saubere Felder übernehmen neue Resultate, auch wenn das eigene Resultat vorher gespeichert war', async () => {
	const h = harness();
	h.editor.edit('m1', 'a', '1'); h.editor.edit('m1', 'b', '0');
	const saved = h.editor.flush('m1'); await h.succeed(0); await saved;
	h.remote({ scoreA: 3, scoreB: 2 });
	assert.equal(h.state.a, '3'); assert.equal(h.state.b, '2');
	h.editor.dispose();
});

test('Speicherfehler nimmt optimistische Tabelle zurück und behält Eingabe samt Fehler', async () => {
	const h = harness();
	const teams = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
	const points = () => calculateStandings(teams, [h.state?.optimistic
		? { ...h.match, ...validateResult({ scoreA: h.state.a, scoreB: h.state.b }, 'liga').values }
		: h.match])[0].points;
	h.editor.edit('m1', 'a', '2'); h.editor.edit('m1', 'b', '0');
	assert.equal(points(), 3);
	const saved = h.editor.flush('m1'); await h.fail(0); await saved;
	assert.equal(points(), 0); assert.match(h.state.error, /fehlgeschlagen/);
	h.remote({ scoreA: null, scoreB: null });
	assert.equal(h.state.a, '2'); assert.equal(h.state.b, '0');
	h.editor.retry('m1'); assert.equal(h.requests.length, 2);
	await h.succeed(1); assert.equal(points(), 3);
	h.editor.dispose();
});

test('K.-o.-Unentschieden wird nicht gesendet; Leeren beider Felder wird gespeichert', async () => {
	const h = harness('ko');
	h.editor.edit('m1', 'a', '1'); h.editor.edit('m1', 'b', '1');
	await h.advance(600); assert.equal(h.requests.length, 0);
	assert.equal(h.state.error, 'Im K.-o. braucht es einen Sieger');
	h.editor.edit('m1', 'b', '0');
	const saved = h.editor.flush('m1'); await h.succeed(0); await saved;
	h.editor.edit('m1', 'a', ''); h.editor.edit('m1', 'b', '');
	await h.advance(600);
	assert.equal(h.requests[1].input.scoreA, null); assert.equal(h.requests[1].input.scoreB, null);
	await h.succeed(1); assert.equal(h.match.status, 'Geplant'); h.editor.dispose();
});

test('Geänderte K.-o.-Teilnehmer überschreiben nicht die Basis einer aktiven Eingabe', () => {
	const h = harness('ko'); h.editor.focus('m1');
	h.remote({ teamAId: null });
	assert.equal(h.state.expected.teamAId, 'a');
	h.editor.blur('m1'); assert.equal(h.state.expected.teamAId, null);
	h.editor.dispose();
});

test('Beim Verlassen werden Timer entfernt und späte Antworten nicht mehr angewendet', async () => {
	const h = harness(); h.editor.edit('m1', 'a', '2'); h.editor.edit('m1', 'b', '1');
	h.editor.dispose(); await h.advance(1000); assert.equal(h.requests.length, 0);
	const second = harness(); second.editor.edit('m1', 'a', '2'); second.editor.edit('m1', 'b', '1');
	const saved = second.editor.flush('m1'); second.editor.dispose(); await second.succeed(0); await saved;
	assert.equal(second.match.scoreA, null);
});
