import { assertOwner } from './permissions.js';

/** Aufruf innerhalb einer Transaktion, nachdem das Turnier gegen Änderungen gesperrt wurde. */
export async function deleteTournamentRecords(db, session, tournament, user) {
	assertOwner(user, tournament);
	await db.collection('teams').deleteMany({ tournamentId: tournament._id }, { session });
	await db.collection('matches').deleteMany({ tournamentId: tournament._id }, { session });
	await db.collection('tournaments').deleteOne({ _id: tournament._id, ownerId: tournament.ownerId }, { session });
}
