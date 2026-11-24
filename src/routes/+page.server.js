import { getDb } from '../lib/server/db.js';

export async function load() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return { dbOk: true };
  } catch (error) {
    console.error('DB-Fehler:', error.message);
    return { dbOk: false };
  }
}