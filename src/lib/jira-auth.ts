import type { NextRequest } from "next/server";
import { authEnabled } from "@/auth.config";
import { hasBasicCreds, jiraEnv } from "./env";
import type { JiraAuth } from "./jira";
import { LOCAL_OWNER, resolveOwner } from "./owner";
import { getUsableTokens } from "./token-store";

export type ResolvedJiraAuth =
  | { ok: true; auth: JiraAuth }
  | { ok: false; status: number; error: string };

/** The signed-in user's stored OAuth token, refreshed (and the rotation persisted) if expired. */
async function oauthFromSession(req: NextRequest): Promise<JiraAuth | null> {
  const accountId = await resolveOwner(req);
  if (!accountId || accountId === LOCAL_OWNER) return null;
  const stored = await getUsableTokens(accountId).catch(() => null);
  if (!stored?.cloudId) return null;
  return { mode: "oauth", cloudId: stored.cloudId, accessToken: stored.accessToken };
}

/** Signed-in OAuth token first, then env API token, otherwise a clear error. */
export async function resolveJiraAuth(req: NextRequest): Promise<ResolvedJiraAuth> {
  if (authEnabled()) {
    const oauth = await oauthFromSession(req);
    if (oauth) return { ok: true, auth: oauth };
  }
  if (hasBasicCreds()) {
    const { baseUrl, email, token } = jiraEnv();
    return { ok: true, auth: { mode: "basic", baseUrl, email, token } };
  }
  return {
    ok: false,
    status: 409,
    error: authEnabled()
      ? "No Jira credentials: sign in again with Atlassian (the session has no usable Jira token or the site could not be matched to JIRA_BASE_URL), or set JIRA_EMAIL and JIRA_API_TOKEN."
      : "No Jira credentials: set JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN, or enable Atlassian login.",
  };
}
