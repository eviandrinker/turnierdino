import { validateTeamRegistration, registrationClosedMessage, openTournamentList } from '../registration-rules.js';
import { tournamentDestination } from '../tournament-list.js';
import { teamSuggestions, selectTeamImports } from '../team-suggestions.js';
import { deleteTournamentRecords } from './tournament-records.js';
import { assertOwner, PermissionError } from './permissions.js';
import { randomInt } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { DB_URI, DB_NAME } from '$app/env/private';
import { validateTournament } from '../tournament-rules.js';
import { normalizeTeamName, validateTeam } from '../team-rules.js';
import { validateSchedule } from '../schedule-rules.js';
import { generateSchedule } from './schedule.js';
import { applyResults, advanceMatchday, tournamentWinner } from './results.js';
import { SEARCH_CATEGORIES, SEARCH_PAGE_SIZE, nameFilter, groupByCategory, pageOf, publicTournament, searchComparators } from '../tournament-search.js';
import { currentMatchday } from '../matchdays.js';

let client;
let connection;
let indexes;

export async function getDb() {
	connection ??= (async () => {
		const candidate = new MongoClient(DB_URI);
		try {
			await candidate.connect();
			client = candidate;
		} catch (error) {
			await candidate.close();
			throw error;
		}
	})();
	try {
		await connection;
	} catch (error) {
		connection = undefined;
		throw error;
	}
	return client.db(DB_NAME);
}

async function ensureIndexes(db) {
	indexes ??= Promise.all([
		db.collection('tournaments').createIndex({ ownerId: 1, createdAt: -1 }),
		db.collection('tournaments').createIndex({ joinCode: 1 }, {
			unique: true, partialFilterExpression: { joinCode: { $type: 'string' } }
		}),
		db.collection('teams').createIndex({ tournamentId: 1, nameKey: 1 }, { unique: true }),
		db.collection('teams').createIndex({ tournamentId: 1, registeredBy: 1 }, {
			unique: true, partialFilterExpression: { registeredBy: { $type: 'objectId' } }
		}),
		db.collection('teams').createIndex({ registeredBy: 1, tournamentId: 1 }),
		db.collection('matches').createIndex({ tournamentId: 1, matchNumber: 1 }, { unique: true })
	]);
	try { await indexes; } catch (error) { indexes = undefined; throw error; }
}

function objectId(id) {
	return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id) ? new ObjectId(id) : null;
}

export class TournamentInputError extends Error {
	constructor(message, errors = {}) {
		super(message);
		this.errors = errors;
	}
}

export async function createTournament(input, user) {
	if (!objectId(user?.id)) throw new PermissionError(401, 'Bitte melde dich zuerst an.');
	const result = validateTournament(input);
	if (!result.valid) throw new TournamentInputError('Ungültige Turnierdaten', result.errors);
	const db = await getDb();
	const { insertedId } = await db.collection('tournaments').insertOne({
		...result.values, ownerId: objectId(user.id), teamEntry: null, startTime: null, fields: null,
		matchDuration: null, currentRound: 1, status: 'Entwurf', createdAt: new Date()
	});
	return insertedId.toHexString();
}

export async function getTournament(id) {
	const _id = objectId(id);
	if (!_id) return null;
	const db = await getDb();
	const tournament = await db.collection('tournaments').findOne({ _id });

	return tournament;
}

export async function getTeams(id) {
	const tournamentId = objectId(id);
	if (!tournamentId) return [];
	const db = await getDb();
	return db.collection('teams').find({ tournamentId }).sort({ createdAt: 1, _id: 1 }).toArray();
}

// Die gemeinsame Turnier-Schreiboperation serialisiert Änderungen auch zwischen Serverinstanzen.
// MongoDB-Transaktionen benötigen ein Replica Set (z. B. Atlas).
async function changeDraft(id, user, change) {
	return changeTournament(id, user, ['Entwurf'], change);
}

async function changeTournament(id, user, statuses, change) {
	if (!objectId(user?.id)) throw new PermissionError(401, 'Bitte melde dich zuerst an.');
	const _id = objectId(id);
	if (!_id) throw new TournamentInputError('Dieses Turnier wurde nicht gefunden.');
	const db = await getDb();
	await ensureIndexes(db);
	return client.withSession((session) => session.withTransaction(async () => {
		const existing = await db.collection('tournaments').findOne({ _id }, { session });
		assertOwner(user, existing);
		const tournament = await db.collection('tournaments').findOneAndUpdate(
			{ _id, ownerId: objectId(user.id), status: { $in: statuses } }, { $inc: { revision: 1 } }, { session, returnDocument: 'after' }
		);
		if (!tournament) throw new TournamentInputError('Dieses Turnier kann nicht mehr bearbeitet werden.');
		return change(db, session, tournament);
	}));
}

export async function addTeam(id, input, user) {
	return changeDraft(id, user, async (db, session, tournament) => {
		if (tournament.teamEntry !== 'manuell') throw new TournamentInputError('Bitte wähle zuerst die manuelle Teamerfassung.');
		const teams = await db.collection('teams').find({ tournamentId: tournament._id }, { session }).toArray();
		const result = validateTeam(input, teams, tournament.teamCount);
		if (!result.valid) throw new TournamentInputError('Bitte prüfe den Team-Namen.', result.errors);
		const { insertedId } = await db.collection('teams').insertOne({
			tournamentId: tournament._id, name: result.values.name,
			nameKey: normalizeTeamName(result.values.name), registeredBy: null, createdAt: new Date()
		}, { session });
		return insertedId.toHexString();
	});
}

export async function removeTeam(id, teamId, user) {
	return changeDraft(id, user, async (db, session, tournament) => {
		if (tournament.teamEntry !== 'manuell') throw new TournamentInputError('Die manuelle Teamerfassung ist nicht aktiv.');
		const _id = objectId(teamId);
		if (!_id) throw new TournamentInputError('Dieses Team wurde nicht gefunden.');
		const result = await db.collection('teams').deleteOne({ _id, tournamentId: tournament._id }, { session });
		if (!result.deletedCount) throw new TournamentInputError('Dieses Team wurde nicht gefunden.');
	});
}

export async function updateTournament(id, changes, user) {
	// Kollisionen des Zufallscodes werden durch den eindeutigen Index erkannt und erneut versucht.
	for (let attempt = 0; attempt < 20; attempt++) {
		try {
			return await changeDraft(id, user, async (db, session, tournament) => {
				let values;
				if (Object.hasOwn(changes, 'teamEntry')) {
					if (!['manuell', 'code'].includes(changes.teamEntry)) throw new TournamentInputError('Bitte wähle ja oder nein.');
					if (tournament.teamEntry && tournament.teamEntry !== changes.teamEntry) throw new TournamentInputError('Die Art der Teamerfassung wurde bereits gewählt.');
					values = { teamEntry: changes.teamEntry };
					if (changes.teamEntry === 'code') values.joinCode = tournament.joinCode ?? String(randomInt(0, 1000000)).padStart(6, '0');
				} else {
					const result = validateSchedule(changes);
					if (!result.valid) throw new TournamentInputError('Bitte prüfe die Ablauf-Angaben.', result.errors);
					if (!['manuell', 'code'].includes(tournament.teamEntry)) throw new TournamentInputError('Bitte wähle zuerst die Teamerfassung.');
					if (tournament.teamEntry === 'code' && !/^\d{6}$/.test(tournament.joinCode ?? '')) throw new TournamentInputError('Bitte erstelle zuerst einen Beitrittscode.');
					if (tournament.teamEntry === 'manuell') {
						const count = await db.collection('teams').countDocuments({ tournamentId: tournament._id }, { session });
						if (count !== tournament.teamCount) throw new TournamentInputError('Bitte erfasse zuerst alle Teams.');
					}
					values = { ...result.values, status: 'Bereit' };
				}
				const update = { $set: values };
				if (values.teamEntry === 'manuell') update.$unset = { joinCode: '' };
				await db.collection('tournaments').updateOne({ _id: tournament._id }, update, { session });
			});
		} catch (error) {
			if (error.code === 11000 && error.keyPattern?.joinCode && changes.teamEntry === 'code') continue;
			throw error;
		}
	}
	throw new Error('Es konnte kein freier Beitrittscode erzeugt werden.');
}

function teamView(team) {
	return { id: team._id.toHexString(), name: team.name, group: team.group ?? null };
}

function matchView(match) {
	const { _id, tournamentId, teamAId, teamBId, ...values } = match;
	return { ...values, id: _id.toHexString(), teamAId: teamAId?.toHexString() ?? null, teamBId: teamBId?.toHexString() ?? null };
}

export async function getMatches(id) {
	const tournamentId = objectId(id);
	if (!tournamentId) return [];
	const db = await getDb();
	return (await db.collection('matches').find({ tournamentId }).sort({ matchNumber: 1 }).toArray()).map(matchView);
}

export async function createMatchSchedule(id, user) {
	const seed = randomInt(0, 0x100000000);
	return changeTournament(id, user, ['Bereit', 'Läuft', 'Abgeschlossen'], async (db, session, tournament) => {
		// Gemeinsame Schreibsperre + eindeutiger Index verhindern paralleles Erzeugen.
		if (await db.collection('matches').findOne({ tournamentId: tournament._id }, { session })) return;
		if (tournament.status !== 'Bereit') throw new TournamentInputError('Der Spielplan kann jetzt nicht erstellt werden.');
		const teams = (await db.collection('teams').find({ tournamentId: tournament._id }, { session }).sort({ createdAt: 1, _id: 1 }).toArray()).map(teamView);
		if (teams.length !== tournament.teamCount) throw new TournamentInputError('Bitte warte, bis alle Teams angemeldet sind.');
		const plan = generateSchedule(tournament, teams, seed);
		if (tournament.mode === 'gruppen_ko') {
			await db.collection('teams').bulkWrite(plan.teams.map((team) => ({
				updateOne: { filter: { _id: objectId(team.id), tournamentId: tournament._id }, update: { $set: { group: team.group } } }
			})), { session });
		}
		await db.collection('matches').insertMany(plan.matches.map((match) => ({
			...match, tournamentId: tournament._id,
			teamAId: objectId(match.teamAId), teamBId: objectId(match.teamBId)
		})), { session });
		await db.collection('tournaments').updateOne({ _id: tournament._id }, { $set: { planCreatedAt: new Date(), currentRound: 1 } }, { session });
	});
}

async function persistMatches(db, session, tournamentId, matches) {
	await db.collection('matches').bulkWrite(matches.map((match) => ({ updateOne: {
		filter: { tournamentId, matchNumber: match.matchNumber },
		update: { $set: {
			teamAId: objectId(match.teamAId), teamBId: objectId(match.teamBId),
			scoreA: match.scoreA, scoreB: match.scoreB, status: match.status
		} }
	} })), { session });
}

export async function getMatch(id) {
	const _id = objectId(id);
	if (!_id) return null;
	return (await getDb()).collection('matches').findOne({ _id });
}

export async function saveMatchResults(id, entries, user) {
	return changeTournament(id, user, ['Bereit', 'Läuft', 'Abgeschlossen'], async (db, session, tournament) => {
		const raw = await db.collection('matches').find({ tournamentId: tournament._id }, { session }).sort({ matchNumber: 1 }).toArray();
		if (!raw.length) throw new TournamentInputError('Bitte erstelle zuerst den Spielplan.');
		const matches = raw.map(matchView);
		const currentRound = currentMatchday(tournament, matches);
		const teams = (await db.collection('teams').find({ tournamentId: tournament._id }, { session }).sort({ createdAt: 1, _id: 1 }).toArray()).map(teamView);
		const result = applyResults(matches, teams, entries, { currentRound });
		if (!result.valid) {
			const error = new TournamentInputError('Bitte prüfe das Resultat.', result.errors);
			error.snapshot = { matches, currentRound, status: tournament.status, revision: tournament.revision - 1 };
			throw error;
		}
		await persistMatches(db, session, tournament._id, result.matches);
		await db.collection('tournaments').updateOne({ _id: tournament._id }, { $set: { status: result.status, currentRound } }, { session });
		return { matches: result.matches, status: result.status, currentRound, revision: tournament.revision };
	});
}

export async function advanceTournamentRound(id, expectedRound, user) {
	return changeTournament(id, user, ['Bereit', 'Läuft', 'Abgeschlossen'], async (db, session, tournament) => {
		const matches = (await db.collection('matches').find({ tournamentId: tournament._id }, { session }).sort({ matchNumber: 1 }).toArray()).map(matchView);
		const teams = (await db.collection('teams').find({ tournamentId: tournament._id }, { session }).sort({ createdAt: 1, _id: 1 }).toArray()).map(teamView);
		const currentRound = currentMatchday(tournament, matches);
		const result = advanceMatchday(matches, teams, currentRound, expectedRound);
		if (!result.valid) throw new TournamentInputError(result.error);
		await persistMatches(db, session, tournament._id, result.matches);
		await db.collection('tournaments').updateOne({ _id: tournament._id }, { $set: { currentRound: result.currentRound } }, { session });
		return result.currentRound;
	});
}

export async function getMyTournaments(userId) {
	const ownerId = objectId(userId);
	if (!ownerId) throw new PermissionError(401, 'Bitte melde dich zuerst an.');
	const db = await getDb();
	const tournaments = await db.collection('tournaments').find({ ownerId }).toArray();
	if (!tournaments.length) return [];
	const totals = await db.collection('teams').aggregate([
		{ $match: { tournamentId: { $in: tournaments.map((t) => t._id) } } },
		{ $group: { _id: '$tournamentId', count: { $sum: 1 } } }
	]).toArray();
	const counts = new Map(totals.map((item) => [item._id.toHexString(), item.count]));
	return tournaments.map((tournament) => {
		const id = tournament._id.toHexString();
		return {
			id, name: tournament.name, mode: tournament.mode, teamCount: tournament.teamCount,
			status: tournament.status, createdAt: tournament.createdAt,
			href: tournamentDestination({ ...tournament, id }, counts.get(id) ?? 0)
		};
	});
}

export async function deleteTournament(id, user) {
	return changeTournament(id, user, ['Entwurf', 'Bereit', 'Läuft', 'Abgeschlossen'], async (db, session, tournament) => {
		await deleteTournamentRecords(db, session, tournament, user);
	});
}

export async function getTeamSuggestions(userId, currentTournamentId) {
	const ownerId = objectId(userId), currentId = objectId(currentTournamentId);
	if (!ownerId) throw new PermissionError(401, 'Bitte melde dich zuerst an.');
	if (!currentId) throw new TournamentInputError('Dieses Turnier wurde nicht gefunden.');
	const db = await getDb();
	const current = await db.collection('tournaments').findOne({ _id: currentId });
	assertOwner({ id: userId }, current);
	const tournaments = await db.collection('tournaments').find({ ownerId }).project({ _id: 1, ownerId: 1 }).toArray();
	const teams = await db.collection('teams').find({ tournamentId: { $in: tournaments.map((t) => t._id) } }).project({ tournamentId: 1, name: 1, createdAt: 1 }).toArray();
	return teamSuggestions(userId, currentId.toHexString(),
		tournaments.map((t) => ({ id: t._id.toHexString(), ownerId: t.ownerId.toHexString() })),
		teams.map((t) => ({ ...t, tournamentId: t.tournamentId.toHexString() }))
	);
}

export async function importTeamsFromLastTournament(id, user) {
	return changeDraft(id, user, async (db, session, tournament) => {
		if (tournament.teamEntry !== 'manuell') throw new TournamentInputError('Die manuelle Teamerfassung ist nicht aktiv.');
		const latest = await db.collection('tournaments').findOne(
			{ ownerId: objectId(user.id), _id: { $ne: tournament._id } },
			{ session, sort: { createdAt: -1, _id: -1 } }
		);
		if (!latest) return 0;
		const existing = await db.collection('teams').find({ tournamentId: tournament._id }, { session }).toArray();
		const source = await db.collection('teams').find({ tournamentId: latest._id }, { session }).sort({ createdAt: 1, _id: 1 }).toArray();
		const selected = selectTeamImports(source, existing, tournament.teamCount);
		if (selected.length) await db.collection('teams').insertMany(selected.map(({ name }) => ({
			tournamentId: tournament._id, name, nameKey: normalizeTeamName(name), registeredBy: null, createdAt: new Date()
		})), { session });
		return selected.length;
	});
}

export async function findTournamentByCode(code) {
	if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return null;
	return (await getDb()).collection('tournaments').findOne({ joinCode: code });
}

export async function getRegistrationDetails(id, user) {
	const tournament = await getTournament(id);
	if (!tournament) return null;
	const teams = await getTeams(id);
	const hasMatches = !!await (await getDb()).collection('matches').findOne({ tournamentId: tournament._id }, { projection: { _id: 1 } });
	const mine = teams.find((team) => user?.id && team.registeredBy?.toString() === user.id);
	return {
		tournament: { id: tournament._id.toHexString(), name: tournament.name, mode: tournament.mode,
			startTime: tournament.startTime, teamCount: tournament.teamCount, status: tournament.status },
		teams: teams.map((team) => ({ id: team._id.toHexString(), name: team.name })),
		ownTeam: mine ? { id: mine._id.toHexString(), name: mine.name } : null,
		canWithdraw: !hasMatches && !tournament.planCreatedAt,
		closedMessage: registrationClosedMessage(tournament, teams.length, hasMatches)
	};
}

// Dieselbe Turnier-Schreibsperre wie bei Spielplanerstellung und Besitzer-Änderungen.
async function changeRegistration(id, user, change) {
	if (!objectId(user?.id)) throw new PermissionError(401, 'Bitte melde dich zuerst an.');
	const _id = objectId(id);
	if (!_id) throw new TournamentInputError('Dieses Turnier wurde nicht gefunden.');
	const db = await getDb();
	await ensureIndexes(db);
	return client.withSession((session) => session.withTransaction(async () => {
		const tournament = await db.collection('tournaments').findOneAndUpdate(
			{ _id }, { $inc: { revision: 1 } }, { session, returnDocument: 'after' }
		);
		if (!tournament) throw new TournamentInputError('Dieses Turnier wurde nicht gefunden.');
		return change(db, session, tournament);
	}));
}

export async function registerTeam(id, input, user) {
	return changeRegistration(id, user, async (db, session, tournament) => {
		const teams = await db.collection('teams').find({ tournamentId: tournament._id }, { session }).toArray();
		const hasMatches = !!await db.collection('matches').findOne({ tournamentId: tournament._id }, { session });
		const result = validateTeamRegistration(tournament, teams, hasMatches, user.id, input);
		if (!result.valid) throw new TournamentInputError(result.message, result.errors);
		await db.collection('teams').insertOne({ tournamentId: tournament._id, name: result.values.name,
			nameKey: normalizeTeamName(result.values.name), registeredBy: objectId(user.id), createdAt: new Date()
		}, { session });
	});
}

export async function unregisterTeam(id, user) {
	return changeRegistration(id, user, async (db, session, tournament) => {
		const hasMatches = await db.collection('matches').findOne({ tournamentId: tournament._id }, { session });
		if (hasMatches || tournament.planCreatedAt) throw new TournamentInputError('Der Spielplan existiert bereits. Du kannst dein Team nicht mehr abmelden.');
		const result = await db.collection('teams').deleteOne({ tournamentId: tournament._id, registeredBy: objectId(user.id) }, { session });
		if (!result.deletedCount) throw new TournamentInputError('Du hast in diesem Turnier kein Team angemeldet.');
	});
}

export async function removeRegisteredTeam(id, teamId, user) {
	return changeTournament(id, user, ['Entwurf', 'Bereit', 'Läuft', 'Abgeschlossen'], async (db, session, tournament) => {
		const hasMatches = await db.collection('matches').findOne({ tournamentId: tournament._id }, { session });
		if (tournament.teamEntry !== 'code' || hasMatches || tournament.planCreatedAt) throw new TournamentInputError('Teams können nur vor der Spielplanerstellung entfernt werden.');
		const _id = objectId(teamId);
		const result = _id ? await db.collection('teams').deleteOne({ _id, tournamentId: tournament._id }, { session }) : { deletedCount: 0 };
		if (!result.deletedCount) throw new TournamentInputError('Dieses Team wurde nicht gefunden.');
	});
}

export async function getMyRegisteredTeam(id, userId) {
	if (!objectId(id) || !objectId(userId)) return null;
	const team = await (await getDb()).collection('teams').findOne({ tournamentId: objectId(id), registeredBy: objectId(userId) });
	return team ? { id: team._id.toHexString(), name: team.name } : null;
}

export async function getOpenTournaments() {
	const db = await getDb();
	const rows = await db.collection('tournaments').aggregate([
		{ $match: { teamEntry: 'code', status: 'Bereit', planCreatedAt: null } },
		{ $lookup: { from: 'matches', localField: '_id', foreignField: 'tournamentId', pipeline: [{ $limit: 1 }, { $project: { _id: 1 } }], as: 'games' } },
		{ $match: { 'games.0': { $exists: false } } },
		{ $lookup: { from: 'teams', localField: '_id', foreignField: 'tournamentId', pipeline: [{ $count: 'total' }], as: 'registrations' } },
		{ $set: { registeredCount: { $ifNull: [{ $arrayElemAt: ['$registrations.total', 0] }, 0] } } },
		{ $match: { $expr: { $lt: ['$registeredCount', '$teamCount'] } } },
		{ $set: { available: { $subtract: ['$teamCount', '$registeredCount'] } } },
		{ $sort: { available: -1, createdAt: -1, _id: 1 } }, { $limit: 50 },
		{ $project: { name: 1, mode: 1, startTime: 1, teamCount: 1, registeredCount: 1, createdAt: 1, status: 1, teamEntry: 1 } }
	]).toArray();
	return openTournamentList(rows.map((row) => ({ ...row, hasMatches: false })));
}

export async function getParticipations(userId) {
	const registeredBy = objectId(userId);
	if (!registeredBy) throw new PermissionError(401, 'Bitte melde dich zuerst an.');
	const db = await getDb();
	const teams = await db.collection('teams').find({ registeredBy }).toArray();
	if (!teams.length) return [];
	const tournaments = await db.collection('tournaments').find({ _id: { $in: teams.map((team) => team.tournamentId) } }).toArray();
	const byId = new Map(teams.map((team) => [team.tournamentId.toHexString(), team.name]));
	return tournaments.map((tournament) => ({ id: tournament._id.toHexString(), name: tournament.name,
		mode: tournament.mode, teamCount: tournament.teamCount, status: tournament.status, createdAt: tournament.createdAt,
		startTime: tournament.startTime, teamName: byId.get(tournament._id.toHexString()), href: `/turnier/${tournament._id.toHexString()}`
	})).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || a.id.localeCompare(b.id));
}

// Aktive Turniere (Bereit/Läuft) werden über searchCategory eingeteilt; diese Obergrenze schützt vor Ausreissern.
const ACTIVE_SEARCH_LIMIT = 1000;

async function winnerNames(db, rows) {
	if (!rows.length) return new Map();
	const ids = rows.map((row) => row._id);
	const [teams, matches] = await Promise.all([
		db.collection('teams').find({ tournamentId: { $in: ids } }).sort({ createdAt: 1, _id: 1 }).toArray(),
		db.collection('matches').find({ tournamentId: { $in: ids } }).sort({ matchNumber: 1 }).toArray()
	]);
	const byTournament = (list) => Map.groupBy(list, (item) => item.tournamentId.toHexString());
	const teamsBy = byTournament(teams), matchesBy = byTournament(matches);
	return new Map(rows.map((row) => {
		const id = row._id.toHexString();
		const views = (teamsBy.get(id) ?? []).map(teamView);
		const winnerId = tournamentWinner(row, views, (matchesBy.get(id) ?? []).map(matchView));
		return [id, views.find((team) => team.id === winnerId)?.name ?? null];
	}));
}

/** Öffentliche Turniersuche: query = { q, category: 'alle' | offen | laufend | abgeschlossen, page }. */
export async function searchTournaments({ q = '', category = 'alle', page = 1 } = {}) {
	const db = await getDb();
	const filter = nameFilter(q);
	const fields = { name: 1, mode: 1, startTime: 1, status: 1, teamCount: 1, teamEntry: 1, planCreatedAt: 1, createdAt: 1 };
	const [active, finishedCount] = await Promise.all([
		db.collection('tournaments').aggregate([
			{ $match: { ...filter, status: { $in: ['Bereit', 'Läuft'] } } },
			{ $sort: { createdAt: -1, _id: 1 } }, { $limit: ACTIVE_SEARCH_LIMIT },
			{ $lookup: { from: 'matches', localField: '_id', foreignField: 'tournamentId', pipeline: [{ $limit: 1 }, { $project: { _id: 1 } }], as: 'games' } },
			{ $lookup: { from: 'teams', localField: '_id', foreignField: 'tournamentId', pipeline: [{ $count: 'total' }], as: 'registrations' } },
			{ $project: { ...fields,
				hasMatches: { $gt: [{ $size: '$games' }, 0] },
				registeredCount: { $ifNull: [{ $arrayElemAt: ['$registrations.total', 0] }, 0] } } }
		]).toArray(),
		db.collection('tournaments').countDocuments({ ...filter, status: 'Abgeschlossen' })
	]);
	const groups = groupByCategory(active);
	const counts = { offen: groups.offen.length, laufend: groups.laufend.length, abgeschlossen: finishedCount };
	const wanted = category === 'alle' ? SEARCH_CATEGORIES : [category];
	const pageNumber = category === 'alle' ? 1 : page;
	const sections = {};
	for (const key of wanted) {
		if (key === 'abgeschlossen') {
			const size = SEARCH_PAGE_SIZE;
			const rows = await db.collection('tournaments').find({ ...filter, status: 'Abgeschlossen' }, { projection: fields })
				.sort({ createdAt: -1, _id: 1 }).skip((pageNumber - 1) * size).limit(size + 1).toArray();
			const shown = rows.slice(0, size).sort(searchComparators.abgeschlossen);
			const ids = shown.map((row) => row._id);
			const registrations = await db.collection('teams').aggregate([
				{ $match: { tournamentId: { $in: ids } } }, { $group: { _id: '$tournamentId', count: { $sum: 1 } } }
			]).toArray();
			const countBy = new Map(registrations.map((item) => [item._id.toHexString(), item.count]));
			const winners = await winnerNames(db, shown);
			sections[key] = { page: pageNumber, hasMore: rows.length > size, items: shown.map((row) => publicTournament(
				{ ...row, registeredCount: countBy.get(row._id.toHexString()) ?? 0 }, key, winners.get(row._id.toHexString()) ?? null
			)) };
		} else {
			const result = pageOf(groups[key], pageNumber);
			sections[key] = { ...result, items: result.items.map((row) => publicTournament(row, key)) };
		}
	}
	return { query: { q, category, page: pageNumber }, counts, sections };
}
