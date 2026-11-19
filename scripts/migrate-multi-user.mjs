// Usage: node scripts/migrate-multi-user.mjs <atlassianAccountId>
// Stamps all pre-existing single-user data with the given owner and swaps old indexes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const accountId = process.argv[2];
if (!accountId) {
  console.error("Usage: node scripts/migrate-multi-user.mjs <atlassianAccountId>");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const raw of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq < 1) continue;
  let val = line.slice(eq + 1).trim();
  if (
    val.length >= 2 &&
    (val.startsWith('"') || val.startsWith("'")) &&
    val.endsWith(val[0])
  ) {
    val = val.slice(1, -1);
  }
  env[line.slice(0, eq).trim()] = val;
}

const uri = env.MONGODB_URI || process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI not found in .env.local");
  process.exit(1);
}
const dbName = env.MONGODB_DB || process.env.MONGODB_DB || "devfolio";

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
try {
  await client.connect();
  const db = client.db(dbName);

  for (const name of ["tickets", "events", "goals"]) {
    const res = await db
      .collection(name)
      .updateMany({ owner: { $exists: false } }, { $set: { owner: accountId } });
    console.log(`${name}: modified ${res.modifiedCount}`);
  }

  for (const [name, oldId] of [
    ["settings", "app"],
    ["syncState", "sync"],
  ]) {
    const col = db.collection(name);
    const old = await col.findOne({ _id: oldId });
    const existing = await col.findOne({ _id: accountId });
    if (old && !existing) {
      await col.insertOne({ ...old, _id: accountId });
      await col.deleteOne({ _id: oldId });
      console.log(`${name}: moved "${oldId}" -> owner doc`);
    } else {
      console.log(`${name}: nothing moved`);
    }
  }

  for (const [name, idx] of [
    ["tickets", "key_1"],
    ["events", "ticketKey_1_type_1_at_1"],
    ["events", "at_1"],
    ["goals", "createdAt_-1"],
  ]) {
    try {
      await db.collection(name).dropIndex(idx);
      console.log(`${name}: dropped index ${idx}`);
    } catch {
      console.log(`${name}: index ${idx} not present`);
    }
  }
} finally {
  await client.close();
}
