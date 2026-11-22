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

## Known bug — the next piece of work

**Hourly OAuth token refresh fails.** Verified live: a session aged past one hour shows
`authError: true` on `/api/status`, while syncs still "pass" only because of the env-token
fallback. Any OAuth-only deployment loses sync an hour after login.

Mechanism (detail in ARCHITECTURE → Token refresh): Atlassian refresh tokens are single-use
and rotate on every refresh; we persist them only in the session cookie plus a 10-minute
in-memory map, and request paths that cannot rewrite cookies lose the rotated token. The next
refresh replays a consumed token and Atlassian kills the chain.

### Designed fix (not yet implemented)

Persist tokens in Mongo, keyed by accountId. The cookie then only identifies the user; Mongo
holds the credentials.

1. New `src/lib/token-store.ts`: collection `oauthTokens`, `_id` = accountId, doc
   `{accessToken, refreshToken, expiresAt, cloudId, siteUrl, updatedAt}`.
2. `jwt` callback (`src/auth.config.ts`): write tokens to the store at sign-in; on expiry or
   `RefreshFailed`, try recovering a working set from the store (and clear the error flag when
   recovery works).
3. `src/lib/jira-auth.ts`: route every refresh through the store — read the current refresh
   token from Mongo, refresh, write the rotated pair back, with the in-flight de-dup map keyed
   by **accountId** (not by refresh token).
4. `src/proxy.ts` currently imports `authEnabled` from `auth.config`; inline the env check
   there instead, so `auth.config` may import mongo without dragging the driver into the
   middleware bundle.
5. After it lands, the author must sign in once more — the current refresh chain is already
   consumed/dead. Verify by letting a session age past one hour and checking `/api/status`
   stays `authError:false` **without** `JIRA_API_TOKEN` set.

## Smaller cleanups

- README "Privacy" section still says "single-user" — multi-user landed; soften the wording.
- `Shell.tsx` has a pre-existing `react-hooks/set-state-in-effect` lint warning in the sync
  effect.
- The Atlassian consent screen reappears on every login (`prompt=consent`, needed for refresh
  tokens). Acceptable, but worth a note on the login page eventually. The OAuth app also shows
  Atlassian's "development mode" banner until it is moved to production in the developer
  console.

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

- `npm run dev`, app on http://localhost:3000. First sync on a long history takes ~a minute.
- Secrets live only in `.env.local` (gitignored). Never print or commit them; verify presence
  by name, not value.
- When touching sync or metrics, re-validate against a real changelog before trusting counts —
  that discipline caught every data bug so far.
- Quick health check: `GET /api/status` → `{signedIn, authError, lastSync, ...}`.
