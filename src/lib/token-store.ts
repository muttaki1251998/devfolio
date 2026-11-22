import type { Collection } from "mongodb";
import { exchangeRefreshToken, isExpired, RefreshRejectedError } from "./atlassian-oauth";
import { getDb } from "./mongo";

/**
 * Atlassian OAuth credentials, one doc per user (`_id` = Atlassian accountId).
 *
 * Refresh tokens rotate and are single-use, so the current pair must live somewhere every
 * request path can both read and write. The session cookie cannot be that place (server
 * components and most API paths can't rewrite it), so the cookie only identifies the user
 * and this collection holds the credentials.
 */
export interface StoredTokens {
  _id: string;
  accessToken: string;
  refreshToken: string;
  /** Epoch seconds. */
  expiresAt: number;
  cloudId?: string;
  siteUrl?: string;
  /** Set when Atlassian rejected the refresh token; cleared by the next sign-in. */
  dead?: boolean;
  updatedAt: Date;
}

async function tokens(): Promise<Collection<StoredTokens>> {
  return (await getDb()).collection<StoredTokens>("oauthTokens");
}

/** Called at sign-in: replaces whatever chain was stored before, dead or not. */
export async function saveTokens(
  accountId: string,
  set: Omit<StoredTokens, "_id" | "dead" | "updatedAt">,
): Promise<void> {
  const col = await tokens();
  await col.updateOne(
    { _id: accountId },
    { $set: { ...set, updatedAt: new Date() }, $unset: { dead: "" } },
    { upsert: true },
  );
}

/** One refresh per account at a time; later callers in this process share its result. */
const inflight = new Map<string, Promise<StoredTokens | null>>();

async function refreshStored(accountId: string): Promise<StoredTokens | null> {
  const col = await tokens();
  // Re-read: another request may have refreshed between the caller's read and now.
  const doc = await col.findOne({ _id: accountId });
  if (!doc || doc.dead) return null;
  if (!isExpired(doc.expiresAt)) return doc;
  try {
    const next = await exchangeRefreshToken(doc.refreshToken);
    const updated = { ...doc, ...next, updatedAt: new Date() };
    // Conditional on the token we consumed, so a sign-in that landed meanwhile wins.
    await col.updateOne(
      { _id: accountId, refreshToken: doc.refreshToken },
      { $set: { ...next, updatedAt: updated.updatedAt } },
    );
    return updated;
  } catch (err) {
    if (!(err instanceof RefreshRejectedError)) throw err;
    // Another process (or a fresh sign-in) may already hold a newer pair.
    const latest = await col.findOne({ _id: accountId });
    if (latest && !latest.dead && latest.refreshToken !== doc.refreshToken) {
      return isExpired(latest.expiresAt) ? refreshStored(accountId) : latest;
    }
    await col.updateOne(
      { _id: accountId, refreshToken: doc.refreshToken },
      { $set: { dead: true, updatedAt: new Date() } },
    );
    return null;
  }
}

/**
 * A usable (unexpired) token set for the account, refreshing and persisting the rotated
 * pair when needed. Returns null when the user has no stored chain or it is dead (they must
 * sign in again); throws on transient failures (Mongo or Atlassian unreachable).
 */
export async function getUsableTokens(accountId: string): Promise<StoredTokens | null> {
  const col = await tokens();
  const doc = await col.findOne({ _id: accountId });
  if (!doc || doc.dead) return null;
  if (!isExpired(doc.expiresAt)) return doc;
  let p = inflight.get(accountId);
  if (!p) {
    p = refreshStored(accountId).finally(() => inflight.delete(accountId));
    inflight.set(accountId, p);
  }
  return p;
}
