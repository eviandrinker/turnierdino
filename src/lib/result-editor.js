import { resultVersion, validateResult } from './result-rules.js';

/** Pro Spiel genau eine laufende Anfrage; spätere Eingaben werden danach gespeichert. */
export function createResultEditor({ getMatch, save, onState, onSaved, delay = setTimeout, cancelDelay = clearTimeout }) {
	const states = new Map(), timers = new Map(), pending = new Set(), requested = new Set();
	let disposed = false;
	const emit = () => { if (!disposed) onState(Object.fromEntries([...states].map(([id, state]) => [id, { ...state }]))); };
	function stateFor(id) {
		if (!states.has(id)) {
			const match = getMatch(id);
			states.set(id, { a: String(match.scoreA ?? ''), b: String(match.scoreB ?? ''), expected: resultVersion(match), version: 0, dirty: false, status: '', error: '', optimistic: false, focused: false, inFlight: false });
		}
		return states.get(id);
	}
	function clearTimer(id) { if (timers.has(id)) cancelDelay(timers.get(id)); timers.delete(id); }
	function validate(id, state) {
		return validateResult({ scoreA: state.a, scoreB: state.b }, getMatch(id).phase);
	}
	function syncState(id, state) {
		if (state.dirty || state.focused || pending.has(id)) return;
		const match = getMatch(id);
		if (!match) { states.delete(id); return; }
		state.a = String(match.scoreA ?? ''); state.b = String(match.scoreB ?? '');
		state.expected = resultVersion(match);
		state.status = match.status === 'Beendet' ? 'saved' : '';
	}
	async function flush(id) {
		clearTimer(id);
		if (disposed) return;
		if (pending.has(id)) { requested.add(id); return; }
		const state = states.get(id);
		if (!state?.dirty || state.error) return;
		const check = validate(id, state);
		if (!check.valid) return;
		const version = state.version;
		pending.add(id); state.inFlight = true; state.status = 'saving'; emit();
		try {
			const response = await save(id, { scoreA: check.values.scoreA, scoreB: check.values.scoreB, expected: state.expected });
			if (disposed) return;
			onSaved(response);
			const saved = response.matches.find((match) => match.id === id);
			state.expected = resultVersion(saved);
			if (state.version === version) {
				state.dirty = false; state.optimistic = false; state.status = 'saved';
			} else {
				const latest = validate(id, state);
				state.status = latest.incomplete ? 'incomplete' : latest.valid ? 'pending' : 'error';
			}
		} catch (error) {
			if (disposed) return;
			state.error = error.message || 'Speichern fehlgeschlagen. Bitte versuche es erneut.';
			state.status = 'error'; state.optimistic = false;
			clearTimer(id); requested.delete(id);
		} finally {
			pending.delete(id);
			state.inFlight = false;
			if (!disposed) {
				syncState(id, state);
				emit();
				if (!state.error && state.dirty && (requested.has(id) || !timers.has(id))) void flush(id);
				requested.delete(id);
			}
		}
	}
	return {
		focus(id) { const state = stateFor(id); syncState(id, state); state.focused = true; emit(); },
		blur(id, { retainFocus = false } = {}) {
			const state = states.get(id);
			if (!state) return;
			state.focused = retainFocus;
			void flush(id);
			syncState(id, state);
			emit();
		},
		edit(id, side, value) {
			const state = stateFor(id);
			state[side] = value; state.version++; state.dirty = true; state.error = '';
			const check = validate(id, state);
			state.optimistic = check.valid;
			state.status = check.incomplete ? 'incomplete' : check.valid ? 'pending' : 'error';
			if (!check.valid && !check.incomplete) state.error = check.error;
			clearTimer(id);
			if (check.valid) timers.set(id, delay(() => { timers.delete(id); void flush(id); }, 600));
			emit();
		},
		reset(id) { if (pending.has(id)) return; clearTimer(id); states.delete(id); emit(); },
		retry(id) {
			const state = states.get(id);
			if (!state) return;
			const check = validate(id, state);
			state.error = check.valid || check.incomplete ? '' : check.error;
			state.optimistic = check.valid;
			state.status = check.incomplete ? 'incomplete' : check.valid ? 'pending' : 'error';
			emit();
			void flush(id);
		},
		sync() {
			for (const [id, state] of states) {
				syncState(id, state);
			}
			emit();
		},
		flush,
		dispose() { disposed = true; for (const id of timers.keys()) clearTimer(id); }
	};
}
