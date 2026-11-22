# Devfolio — Handoff

Where the work stands, what is known-broken, and what comes next. Companion to
`ARCHITECTURE.md` (how the system works). Last updated: 2026-11-22.

## Done and verified

In commit order:

1. **Scaffold** (`45825b0`) — all five screens, sync engine, metrics, settings. Metric
   definitions were validated against manually-read Jira changelogs before being trusted:
   first-set-by-author semantics for pregroomed/sent-to-testing, QA bounce as testing→rework.
2. **Morning Press redesign** (`356289e`) — editorial theme across all pages, sticky sidebar,
   GSAP reveals. Verified in browser.
3. **Optional sign-in** (`200b0c9`, reworked in `d762430`) — Auth.js v5. Google/Microsoft
   providers were replaced by a single **Atlassian OAuth** provider whose token doubles as the
   Jira credential. Full loop verified live: sign-in → consent → dashboard, OAuth-powered sync
   (`authError:false` proves the cloudId Bearer path), logout, silent re-sign-in.
4. **Multi-user** (`45c1fc7`) — every collection keyed by `owner` (Atlassian accountId, or
   `"local"` with auth off). Includes the `token.sub` lesson (see ARCHITECTURE: Identity) —
   the first attempt used `sub` and forked a parallel copy of all data under a random UUID,
   which had to be hunted down and deleted. `scripts/migrate-multi-user.mjs` stamps
   pre-multi-user docs with an owner; it ran once against the author's data.
   Also fixed in this commit: `isMine` reconciliation (incremental syncs used to wipe and
   re-mark only the batch, undercounting My Tickets).
5. **Published to GitHub** (2026-11-22) — history checked clean of `.env*`/secrets first.
6. **Dashboard periods** (2026-11-22) — This week / This month / This quarter / Last 12 months /
   Year to date / All time. The chart covers the selected period: a bar per day for the week,
   per week for the month, per month for everything longer (calendar periods include their
   not-yet-reached buckets, empty). Counts and chart now see every event in range (they were
   capped at the newest 1000). Verified in the browser against real data: each period's
   chart bars sum to its stat tiles.

## In progress — hourly OAuth token refresh (fix implemented, live check pending)

**The bug.** A session aged past one hour showed `authError: true` on `/api/status`; syncs
still "passed" only through the env-token fallback, so any OAuth-only deployment lost sync an
hour after login. Atlassian refresh tokens are single-use and rotate on every refresh; we kept
them only in the session cookie plus an in-memory map, request paths that can't rewrite
cookies lost the rotated token, and the next refresh replayed a consumed one, killing the
chain.

**The fix (committed 2026-11-22).** Tokens now live in Mongo, keyed by accountId;
the cookie only identifies the user.

1. `src/lib/token-store.ts` — collection `oauthTokens`, `_id` = accountId, doc
   `{accessToken, refreshToken, expiresAt, cloudId, siteUrl, dead?, updatedAt}`.
   `getUsableTokens(accountId)` returns an unexpired set, refreshing when needed: one refresh
   per account at a time (in-flight map keyed by accountId), the rotated pair written back
   conditionally on the token that was consumed. A 4xx from Atlassian marks the chain `dead`
   (no further refresh attempts) unless the store already holds a newer pair; network/5xx
   errors throw and are retried on the next call. `saveTokens` (sign-in) replaces the chain
   and clears `dead`.
2. `src/auth.config.ts` `jwt` callback — at sign-in, saves tokens to the store and keeps only
   `accountId`/`cloudId`/`siteUrl` in the cookie. On every later read it strips legacy token
   fields from old cookies and sets `error` from `getUsableTokens` — so a recovered chain
   clears the flag, and `authError` reflects the store, not a sticky cookie bit.
3. `src/lib/jira-auth.ts` — resolves the owner via `resolveOwner` and reads the store; no
   longer calls `auth()` or refreshes from the cookie.
4. `src/lib/atlassian-oauth.ts` — `refreshTokens` + its refresh-token-keyed in-flight map are
   gone; `exchangeRefreshToken` does a single exchange and throws `RefreshRejectedError` on 4xx.
5. `src/proxy.ts` — `authEnabled` inlined so the middleware no longer imports `auth.config`
   (and through it the Mongo driver).

**Verified:** `tsc` clean; lint unchanged (same 5 pre-existing problems). Against the dev
server with minted session cookies for throwaway accountIds: a valid stored set clears a
legacy cookie's stale `RefreshFailed`; an expired set with a rejected refresh token reports
`authError:true`, marks the doc `dead`, and the next call returns without contacting
Atlassian; no stored chain reports `authError:true`. Test docs were deleted afterwards.

**Still to do:**

- ~~Sign in once more~~ — done 2026-11-22; the author's chain is in `oauthTokens`.
- The real check: let a session age past one hour, then confirm `/api/status` stays
  `authError:false` and a sync succeeds **without** `JIRA_API_TOKEN` set.

## Smaller cleanups — done

- README "Privacy" no longer says "single-user"; it describes per-account data and where
  tokens live.
- `npx eslint src` is clean. The two `set-state-in-effect` spots were fixed properly:
  `app/page.tsx` reads the clock via a new `useMounted` hook (`useSyncExternalStore`, false
  during prerender/hydration) instead of `setNow` in an effect; `Shell.tsx` sets status in the
  fetch's `.then` and schedules the first background sync with `setTimeout(…, 0)` (cleared on
  cleanup, so a dev-mode effect re-run no longer double-syncs). `window.location.assign` became
  `router.replace`, and a stale `eslint-disable` in `lib/mongo.ts` is gone.
- `/api/status` really never 401s now: `proxy.ts`'s matcher skips it, and the route returns
  only `{configured:false, auth:{enabled, signedIn:false}}` to signed-out callers (no env
  flags, no Jira URL). Signed-in responses gained `auth.signedIn`. `Shell.tsx` sends a
  signed-out user to `/login` when status says so (expired session mid-visit).
- Login page explains the consent screen that appears on every sign-in.
- Still open, needs the author: move the Atlassian OAuth app to production in the developer
  console to drop the "development mode" banner.

## Parked / roadmap

- **Wins log** + monthly export for review season (README roadmap).
- **AI assistant** ("what did I ship in March?").
- **Dark mode** — the design mock's ink-spine sidebar hints at it.
- **Multi-site support** (one Jira site per deployment today, resolved from `JIRA_BASE_URL`).
- **Orca IDE plugin** — a separate repo (standalone Jira-tickets panel for the Orca agent IDE:
  ticket lists, start-an-agent-on-a-ticket, standup prompt). Built and type-checked but
  untested in a real Orca; blocked on Orca app version ≥ 1.4.259. Unrelated to this codebase
  beyond sharing the Jira domain.

## Working on this repo

- `npm run dev`, app on http://localhost:3000 (the Atlassian OAuth callback is registered
  for :3000, so other ports can't complete a login). First sync on a long history takes ~a minute.
- Secrets live only in `.env.local` (gitignored). Never print or commit them; verify presence
  by name, not value.
- When touching sync or metrics, re-validate against a real changelog before trusting counts —
  that discipline caught every data bug so far.
- Quick health check: `GET /api/status` → `{configured, sync, auth: {enabled, signedIn, authError}, ...}`.
  It never 401s; signed-out callers get only the `auth` block.
