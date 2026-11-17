import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { authEnabled } from "@/auth.config";
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
  const authOn = authEnabled();
  const session = authOn ? await auth() : null;
  const user = session?.user
    ? { name: session.user.name ?? null, email: session.user.email ?? null }
    : null;
  return NextResponse.json({
    env,
    mongoOk,
    configured: isConfigured() && mongoOk,
    sync,
    auth: { enabled: authOn, user },
  });
}
