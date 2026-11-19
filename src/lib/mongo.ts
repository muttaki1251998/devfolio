import { Db, MongoClient } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var _devfolioMongo: Promise<MongoClient> | undefined;
}

function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Add it to .env.local");
  }
  if (!global._devfolioMongo) {
    global._devfolioMongo = new MongoClient(uri, {
      serverSelectionTimeoutMS: 4000,
    }).connect();
  }
  return global._devfolioMongo;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB || "devfolio");
}

let indexesEnsured = false;

export async function ensureIndexes(db: Db) {
  if (indexesEnsured) return;
  indexesEnsured = true;
  await Promise.all([
    db.collection("tickets").createIndex({ owner: 1, key: 1 }, { unique: true }),
    db
      .collection("events")
      .createIndex({ owner: 1, ticketKey: 1, type: 1, at: 1 }, { unique: true }),
    db.collection("events").createIndex({ owner: 1, at: 1 }),
    db.collection("goals").createIndex({ owner: 1, createdAt: -1 }),
  ]);
}

export async function pingMongo(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
