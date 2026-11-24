import { randomInt } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { DB_URI, DB_NAME } from '$app/env/private';
import { validateTournament } from '../tournament-rules.js';
import { normalizeTeamName, validateTeam } from '../team-rules.js';
import { validateSchedule } from '../schedule-rules.js';

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
		db.collection('tournaments').createIndex({ joinCode: 1 }, {
			unique: true, partialFilterExpression: { joinCode: { $type: 'string' } }
		}),
		db.collection('teams').createIndex({ tournamentId: 1, nameKey: 1 }, { unique: true })
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

export async function createTournament(input) {
	const result = validateTournament(input);
	if (!result.valid) throw new TournamentInputError('Ungültige Turnierdaten', result.errors);
	const db = await getDb();
	const { insertedId } = await db.collection('tournaments').insertOne({
		...result.values, teamEntry: null, startTime: null, fields: null,
		matchDuration: null, status: 'Entwurf', createdAt: new Date()
	});
	return insertedId.toHexString();
}

export async function getTournament(id) {
	const _id = objectId(id);
	if (!_id) return null;
	const db = await getDb();
	return db.collection('tournaments').findOne({ _id });
}

export async function getTeams(id) {
	const tournamentId = objectId(id);
	if (!tournamentId) return [];
	const db = await getDb();
	return db.collection('teams').find({ tournamentId }).sort({ createdAt: 1, _id: 1 }).toArray();
}

// Die gemeinsame Turnier-Schreiboperation serialisiert Änderungen auch zwischen Serverinstanzen.
// MongoDB-Transaktionen benötigen ein Replica Set (z. B. Atlas).
async function changeDraft(id, change) {
	const _id = objectId(id);
	if (!_id) throw new TournamentInputError('Dieses Turnier wurde nicht gefunden.');
	const db = await getDb();
	await ensureIndexes(db);
	return client.withSession((session) => session.withTransaction(async () => {
		const tournament = await db.collection('tournaments').findOneAndUpdate(
			{ _id, status: 'Entwurf' }, { $inc: { revision: 1 } }, { session, returnDocument: 'after' }
		);
		if (!tournament) throw new TournamentInputError('Dieses Turnier kann nicht mehr bearbeitet werden.');
		return change(db, session, tournament);
	}));
}

export async function addTeam(id, input) {
	return changeDraft(id, async (db, session, tournament) => {
		if (tournament.teamEntry !== 'manuell') throw new TournamentInputError('Bitte wähle zuerst die manuelle Teamerfassung.');
		const teams = await db.collection('teams').find({ tournamentId: tournament._id }, { session }).toArray();
		const result = validateTeam(input, teams, tournament.teamCount);
		if (!result.valid) throw new TournamentInputError('Bitte prüfe den Team-Namen.', result.errors);
		const { insertedId } = await db.collection('teams').insertOne({
			tournamentId: tournament._id, name: result.values.name,
			nameKey: normalizeTeamName(result.values.name), createdAt: new Date()
		}, { session });
		return insertedId.toHexString();
	});
}

export async function removeTeam(id, teamId) {
	return changeDraft(id, async (db, session, tournament) => {
		if (tournament.teamEntry !== 'manuell') throw new TournamentInputError('Die manuelle Teamerfassung ist nicht aktiv.');
		const _id = objectId(teamId);
		if (!_id) throw new TournamentInputError('Dieses Team wurde nicht gefunden.');
		const result = await db.collection('teams').deleteOne({ _id, tournamentId: tournament._id }, { session });
		if (!result.deletedCount) throw new TournamentInputError('Dieses Team wurde nicht gefunden.');
	});
}

export async function updateTournament(id, changes) {
	// Kollisionen des Zufallscodes werden durch den eindeutigen Index erkannt und erneut versucht.
	for (let attempt = 0; attempt < 20; attempt++) {
		try {
			return await changeDraft(id, async (db, session, tournament) => {
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
