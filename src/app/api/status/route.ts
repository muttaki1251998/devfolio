import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { authEnabled } from "@/auth.config";
import { envStatus, isConfigured } from "@/lib/env";
import { pingMongo } from "@/lib/mongo";
import { resolveOwner } from "@/lib/owner";
import { getSyncState } from "@/lib/sync";


export async function GET(req: NextRequest) {
  const env = envStatus();
  let mongoOk = false;
  let sync = null;
  if (env.mongodbUri) {
    mongoOk = await pingMongo();
    const owner = mongoOk ? await resolveOwner(req).catch(() => null) : null;
    if (mongoOk && owner) {
      const s = await getSyncState(owner).catch(() => null);
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
  const authError = !!session?.authError;
  return NextResponse.json({
    env,
    mongoOk,
    configured: isConfigured() && mongoOk,
    sync,
    auth: { enabled: authOn, user, authError },
    jiraBaseUrl:
      process.env.JIRA_BASE_URL?.replace(/[/]+$/, "") || session?.jiraSiteUrl || null,
  });
}
