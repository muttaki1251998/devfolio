import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { auth } from "@/auth";
import { authEnabled } from "@/auth.config";
import type { AppJWT } from "@/auth.config";
import { isExpired, refreshTokens } from "./atlassian-oauth";
import { hasBasicCreds, jiraEnv } from "./env";
import type { JiraAuth } from "./jira";

export type ResolvedJiraAuth =
  | { ok: true; auth: JiraAuth }
  | { ok: false; status: number; error: string };

async function oauthFromSession(req: NextRequest): Promise<JiraAuth | null> {
  // Running the session lookup first lets the jwt callback rotate the tokens and
  // re-issue the cookie; the refresh below then reuses that same exchange.
  await auth();
  const secure =
    req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const token = (await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: secure,
  })) as AppJWT | null;
  if (!token?.accessToken || !token.cloudId || token.error) return null;
  if (!isExpired(token.expiresAt)) {
    return { mode: "oauth", cloudId: token.cloudId, accessToken: token.accessToken };
  }
  if (!token.refreshToken) return null;
  try {
    const fresh = await refreshTokens(token.refreshToken);
    return { mode: "oauth", cloudId: token.cloudId, accessToken: fresh.accessToken };
  } catch {
    return null;
  }
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
