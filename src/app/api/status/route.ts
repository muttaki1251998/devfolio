import { NextResponse } from "next/server";
import { envStatus, isConfigured } from "@/lib/env";
import { pingMongo } from "@/lib/mongo";
import { getSyncState } from "@/lib/sync";


export async function GET() {
  const env = envStatus();
  let mongoOk = false;
  let sync = null;
  if (env.mongodbUri) {
    mongoOk = await pingMongo();
    if (mongoOk) {
      const s = await getSyncState().catch(() => null);
      sync = s
        ? { lastSyncAt: s.lastSyncAt, lastSyncResult: s.lastSyncResult, displayName: s.displayName }
        : null;
    }
  }
  return NextResponse.json({ env, mongoOk, configured: isConfigured() && mongoOk, sync });
}
