import { validateTournament } from '../tournament-rules.js';
import { validateSchedule } from '../schedule-rules.js';

/** Deterministisch für denselben Seed; Zufallsquelle wird vom Aufrufer geliefert. */
export function shuffled(items, seed) {
	const result = [...items];
	let state = seed >>> 0;
	for (let i = result.length - 1; i > 0; i--) {
		state = (Math.imul(1664525, state) + 1013904223) >>> 0;
		const j = Math.floor((state / 4294967296) * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

export function roundRobin(teamIds) {
	const ring = [...teamIds];
	if (ring.length % 2) ring.push(null);
	const rounds = [];
	for (let round = 0; round < ring.length - 1; round++) {
		const pairs = [];
		for (let i = 0; i < ring.length / 2; i++) {
			const a = ring[i], b = ring[ring.length - 1 - i];
			if (a !== null && b !== null) pairs.push(round % 2 ? [b, a] : [a, b]);
		}
		rounds.push(pairs);
		ring.splice(1, 0, ring.pop());
	}
	return rounds;
}

export function groupPairings(groups, qualifiers) {
	const pairs = [];
	const source = (group, rank) => ({ type: 'group', group, rank });
	if (qualifiers === 1) {
		for (let i = 0; i < groups.length; i += 2) pairs.push([source(groups[i], 1), source(groups[i + 1], 1)]);
	} else {
		for (let rank = 1; rank <= qualifiers / 2; rank++) {
			for (const reverse of [false, true]) {
				for (let i = 0; i < groups.length; i += 2) {
					pairs.push([source(groups[i + Number(reverse)], rank), source(groups[i + Number(!reverse)], qualifiers + 1 - rank)]);
				}
			}
		}
	}
	return pairs;
}

const roundNames = { 2: 'Final', 4: 'Halbfinal', 8: 'Viertelfinal', 16: 'Achtelfinal' };

/** Kein DB-Zugriff und keine implizite Zufallsquelle. Team-IDs sind Strings. */
export function generateSchedule(tournament, inputTeams, seed = 0) {
	const rules = validateTournament(tournament), timing = validateSchedule(tournament);
	if (!rules.valid || !timing.valid) throw new Error('Ungültige Turnierangaben.');
	tournament = { ...tournament, ...rules.values, ...timing.values };
	if (inputTeams.length !== tournament.teamCount || new Set(inputTeams.map((team) => team.id)).size !== inputTeams.length) throw new Error('Es müssen genau alle Teams erfasst sein.');
	const teams = inputTeams.map((team) => ({ ...team }));
	const matches = [];
	const batches = [];
	function add(batch, values) {
		const match = {
			matchNumber: matches.length + 1, group: null, teamAId: null, teamBId: null,
			sourceA: null, sourceB: null, scoreA: null, scoreB: null, status: 'Geplant', ...values
		};
		matches.push(match); batch.push(match);
		return match;
	}
	let knockoutPairs;
	if (tournament.mode === 'liga' || tournament.mode === 'gruppen_ko') {
		const groups = tournament.mode === 'liga' ? [null] : Array.from({ length: tournament.groupCount }, (_, i) => String.fromCharCode(65 + i));
		if (tournament.mode === 'gruppen_ko') {
			shuffled(teams, seed).forEach((team, i) => { team.group = groups[i % groups.length]; });
		}
		const schedules = groups.map((group) => ({ group, rounds: roundRobin(teams.filter((team) => group === null || team.group === group).map((team) => team.id)) }));
		for (let r = 0; r < Math.max(...schedules.map((s) => s.rounds.length)); r++) {
			const batch = [];
			for (const { group, rounds } of schedules) {
				for (const [teamAId, teamBId] of rounds[r] ?? []) add(batch, {
					phase: group === null ? 'liga' : 'gruppe', group, round: r + 1, roundName: `Runde ${r + 1}`, teamAId, teamBId
				});
			}
			batches.push(batch);
		}
		if (tournament.mode === 'gruppen_ko') knockoutPairs = groupPairings(groups, tournament.qualifiersPerGroup).map(([sourceA, sourceB]) => ({ sourceA, sourceB }));
	} else {
		const order = shuffled(teams, seed);
		knockoutPairs = [];
		for (let i = 0; i < order.length; i += 2) knockoutPairs.push({ teamAId: order[i].id, teamBId: order[i + 1].id });
	}
	let round = 1;
	while (knockoutPairs?.length) {
		const batch = [];
		for (const pair of knockoutPairs) add(batch, { phase: 'ko', round, roundName: roundNames[knockoutPairs.length * 2], ...pair });
		batches.push(batch);
		if (batch.length === 1) break;
		knockoutPairs = [];
		for (let i = 0; i < batch.length; i += 2) knockoutPairs.push({
			sourceA: { type: 'winner', matchNumber: batch[i].matchNumber },
			sourceB: { type: 'winner', matchNumber: batch[i + 1].matchNumber }
		});
		round++;
	}
	const [hour, minute] = tournament.startTime.split(':').map(Number);
	let window = 0;
	for (const batch of batches) {
		const pending = [...batch];
		while (pending.length) {
			const occupied = new Set();
			let field = 1;
			for (let i = 0; i < pending.length && field <= tournament.fields;) {
				const match = pending[i];
				const ids = [match.teamAId, match.teamBId].filter(Boolean);
				if (ids.some((id) => occupied.has(id))) { i++; continue; }
				const minutes = hour * 60 + minute + window * (tournament.matchDuration + 5);
				match.field = field++;
				match.scheduledDay = Math.floor(minutes / 1440);
				match.scheduledTime = `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
				ids.forEach((id) => occupied.add(id));
				pending.splice(i, 1);
			}
			window++;
		}
	}
	return { teams, matches };
}
