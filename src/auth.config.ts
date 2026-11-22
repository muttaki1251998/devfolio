import type { NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Atlassian from "next-auth/providers/atlassian";
import { resolveSite } from "@/lib/atlassian-oauth";
import { getUsableTokens, saveTokens } from "@/lib/token-store";

export interface ProviderInfo {
  id: "atlassian";
  label: string;
}

const atlassianOn = () => !!(process.env.AUTH_ATLASSIAN_ID && process.env.AUTH_ATLASSIAN_SECRET);

export function configuredProviders(): ProviderInfo[] {
  return atlassianOn() ? [{ id: "atlassian", label: "Atlassian" }] : [];
}

/** Login is only enforced when a secret and the Atlassian OAuth app are configured. */
export function authEnabled(): boolean {
  return !!process.env.AUTH_SECRET && atlassianOn();
}

export function allowedEmails(): string[] {
  const raw = process.env.ALLOWED_EMAILS?.trim() || process.env.JIRA_EMAIL?.trim() || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Fields kept in the encrypted session cookie; never copied to the browser-facing session.
 * The cookie only identifies the user — OAuth tokens live in Mongo (`lib/token-store.ts`),
 * because rotated refresh tokens can't be written back to a cookie on every request path.
 */
export interface JiraTokenFields {
  /** Legacy: sessions issued before the token store carried these; stripped on next read. */
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  cloudId?: string;
  accountId?: string;
  siteUrl?: string;
  error?: "RefreshFailed";
}

export type AppJWT = JWT & JiraTokenFields;

function buildProviders(): NextAuthConfig["providers"] {
  if (!atlassianOn()) return [];
  return [
    Atlassian({
      clientId: process.env.AUTH_ATLASSIAN_ID,
      clientSecret: process.env.AUTH_ATLASSIAN_SECRET,
      authorization: {
        params: {
          scope: "read:me read:jira-work read:jira-user offline_access",
          audience: "api.atlassian.com",
          prompt: "consent",
        },
      },
    }),
  ];
}

export const authConfig: NextAuthConfig = {
  providers: buildProviders(),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    signIn({ profile, user }) {
      const email = (user?.email ?? profile?.email ?? "").toLowerCase();
      if (!email) return false;
      return allowedEmails().includes(email);
    },
    async jwt({ token, account, profile }) {
      const t = token as AppJWT;
      if (account) {
        // token.sub is a random UUID in Auth.js v5 without a DB adapter; the stable
        // identity is Atlassian's account_id, from the userinfo profile or /me.
        let accountId = (profile as { account_id?: string } | undefined)?.account_id;
        if (!accountId && account.access_token) {
          accountId = await fetch("https://api.atlassian.com/me", {
            headers: { Authorization: `Bearer ${account.access_token}` },
          })
            .then((r) => (r.ok ? (r.json() as Promise<{ account_id?: string }>) : null))
            .then((j) => j?.account_id ?? undefined)
            .catch(() => undefined);
        }
        t.accountId = accountId;
        const site = account.access_token
          ? await resolveSite(account.access_token, process.env.JIRA_BASE_URL).catch(() => null)
          : null;
        t.cloudId = site?.cloudId;
        t.siteUrl = site?.siteUrl;
        t.error = "RefreshFailed";
        if (accountId && account.access_token && account.refresh_token) {
          try {
            await saveTokens(accountId, {
              accessToken: account.access_token,
              refreshToken: account.refresh_token,
              expiresAt: account.expires_at ?? 0,
              cloudId: site?.cloudId,
              siteUrl: site?.siteUrl,
            });
            t.error = undefined;
          } catch {
            // Mongo unreachable: signed in, but without a stored Jira credential.
          }
        }
        return t;
      }
      // Tokens no longer ride in the cookie; drop them from pre-token-store sessions.
      delete t.accessToken;
      delete t.refreshToken;
      delete t.expiresAt;
      if (!t.accountId) return t;
      // The stored chain is the truth: this also recovers a session whose earlier refresh
      // failed transiently, and refreshes (and persists the rotation) when expired.
      const stored = await getUsableTokens(t.accountId).catch(() => null);
      t.error = stored ? undefined : "RefreshFailed";
      return t;
    },
    session({ session, token }) {
      const t = token as AppJWT;
      session.authError = !!t.error;
      session.jiraSiteUrl = t.siteUrl ?? null;
      session.accountId = t.accountId ?? null;
      return session;
    },
  },
};
