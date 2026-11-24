import { MongoClient, ObjectId } from 'mongodb';
import { DB_URI, DB_NAME } from '$app/env/private';
import { validateTournament } from '../tournament-rules.js';

let client;

// Baut die Verbindung beim ersten Aufruf auf und verwendet sie danach weiter
export async function getDb() {
  if (!client) {
    const newClient = new MongoClient(DB_URI);
    await newClient.connect();
    client = newClient;
  }
  return client.db(DB_NAME);
}

export async function createTournament(input) {
  const result = validateTournament(input);
  if (!result.valid) throw new Error('Ungültige Turnierdaten');

  const db = await getDb();
  const { insertedId } = await db.collection('tournaments').insertOne({
    ...result.values,
    startTime: null,
    fields: null,
    matchDuration: null,
    status: 'Entwurf',
    createdAt: new Date()
  });
  return insertedId.toHexString();
}

export async function getTournament(id) {
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) return null;
  const db = await getDb();
  return db.collection('tournaments').findOne({ _id: new ObjectId(id) });
}
