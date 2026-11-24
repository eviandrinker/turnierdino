import { MongoClient } from 'mongodb';
import { DB_URI, DB_NAME } from '$app/env/private';

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