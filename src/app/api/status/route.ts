import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { authEnabled } from "@/auth.config";
import { envStatus, isConfigured } from "@/lib/env";
import { pingMongo } from "@/lib/mongo";
import { resolveOwner } from "@/lib/owner";
import { getSyncState } from "@/lib/sync";

/**
 * Lightweight poll for the shell. Never 401s (the proxy lets it through): signed-out callers
 * get `auth.signedIn: false` and nothing about the deployment beyond whether login is on.
 */
export async function GET(req: NextRequest) {
  const authOn = authEnabled();
  const session = authOn ? await auth() : null;
  // Same rule as the proxy: signed in means a session with an Atlassian accountId.
  const signedIn = !authOn || !!session?.accountId;
  if (!signedIn) {
    return NextResponse.json({
      configured: false,
      auth: { enabled: true, signedIn: false, user: null, authError: false },
    });
  }

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
  const user = session?.user
    ? { name: session.user.name ?? null, email: session.user.email ?? null }
    : null;
  return NextResponse.json({
    env,
    mongoOk,
    configured: isConfigured() && mongoOk,
    sync,
    auth: { enabled: authOn, signedIn: true, user, authError: !!session?.authError },
    jiraBaseUrl:
      process.env.JIRA_BASE_URL?.replace(/[/]+$/, "") || session?.jiraSiteUrl || null,
  });
}
