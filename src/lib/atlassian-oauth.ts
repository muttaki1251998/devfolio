const TOKEN_URL = "https://auth.atlassian.com/oauth/token";
const RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources";

/** Refresh slightly before the real expiry so a request never starts with a dying token. */
const EXPIRY_SKEW_SECONDS = 60;

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  /** Epoch seconds. */
  expiresAt: number;
}

export function isExpired(expiresAt: number | undefined): boolean {
  if (!expiresAt) return true;
  return Date.now() / 1000 >= expiresAt - EXPIRY_SKEW_SECONDS;
}

/**
 * Atlassian rejected the refresh token itself (consumed, revoked or expired). Rotating
 * refresh tokens are single-use, so the chain is dead until the user signs in again.
 * Network and 5xx failures throw a plain Error instead and are worth retrying.
 */
export class RefreshRejectedError extends Error {}

/**
 * Exchanges a refresh token once. Callers must not replay `refreshToken` afterwards:
 * Atlassian invalidates it and returns a new one. Go through `token-store.ts`, which
 * persists the rotated pair and de-duplicates concurrent refreshes per account.
 */
export async function exchangeRefreshToken(refreshToken: string): Promise<TokenSet> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: process.env.AUTH_ATLASSIAN_ID,
      client_secret: process.env.AUTH_ATLASSIAN_SECRET,
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const msg = `Atlassian token refresh failed: ${res.status}`;
    throw res.status >= 400 && res.status < 500 ? new RefreshRejectedError(msg) : new Error(msg);
  }
  const j = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token || refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + j.expires_in,
  };
}

export interface AccessibleResource {
  id: string;
  url: string;
  name?: string;
}

const norm = (u: string) => u.trim().replace(/\/+$/, "").toLowerCase();

/** Finds the Jira site this login should talk to. */
export async function resolveSite(
  accessToken: string,
  baseUrl: string | undefined,
): Promise<{ cloudId: string; siteUrl: string } | null> {
  const res = await fetch(RESOURCES_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const list = (await res.json()) as AccessibleResource[];
  let match: AccessibleResource | undefined;
  if (baseUrl) {
    match = list.find((r) => norm(r.url) === norm(baseUrl));
  } else if (list.length === 1) {
    match = list[0];
  }
  return match ? { cloudId: match.id, siteUrl: match.url.replace(/\/+$/, "") } : null;
}
