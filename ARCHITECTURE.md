# jiramorning — Architecture

A map of how the system works, written for coding agents and contributors. The README covers
what the app does and how to set it up; this file covers how the pieces fit and the traps that
cost real debugging time. Read `HANDOFF.md` for the current state of the work.

## Stack

- **Next.js 16** (App Router, Turbopack, TypeScript) with `cacheComponents` enabled — see
  constraints below. One app, no separate backend: all server logic lives in API routes and
  server components.
- **MongoDB** (official driver, no ODM). Works against Atlas or a local instance.
- **Auth.js v5** (`next-auth@5 beta`) with an Atlassian OAuth 2.0 (3LO) provider — optional,
  enabled by env vars.
- **Tailwind CSS 4**, **GSAP** (reveal/count-up animations), **Recharts** (dashboard chart).

## Directory map

```
src/
  proxy.ts                  Next 16 middleware: gates every page/API when auth is on
  auth.ts                   Auth.js entry (exports auth, handlers, signIn, signOut)
  auth.config.ts            Provider, allowlist, jwt/session callbacks, token refresh wiring
  app/
    page.tsx                Home: greeting, since-yesterday, drafted standup, board, stale list
    tickets/ dashboard/ goals/ settings/ login/
    api/
      auth/[...nextauth]/   Auth.js routes
      summary/ metrics/ tickets/ goals/ settings/  Read APIs (owner-scoped)
      sync/                 POST: trigger a sync; GET inside status
      status/               Lightweight poll: auth state, last sync, sync errors
  components/
    Shell.tsx               Sidebar layout + 15-min auto-sync trigger
    Reveal.tsx CountUp.tsx  GSAP entrance animations
    useData.ts              Client fetch hook (SWR-ish, no library)
    useMounted.ts           Hydration-safe "mounted" flag for browser-only values like now
  lib/
    env.ts                  Env access helpers (authEnabled lives in auth.config)
    owner.ts                resolveOwner(req) → data-scoping identity (see Multi-user)
    mongo.ts                Client singleton, collection accessors, index creation
    jira.ts                 Jira REST calls (search, changelog) against either auth mode
    jira-auth.ts            Credential resolution: session OAuth → env Basic fallback
    atlassian-oauth.ts      Refresh-token exchange, expiry check, cloudId/site resolution
    token-store.ts          Mongo-backed OAuth tokens per accountId; serialized refresh
    sync.ts                 The sync engine (see below)
    metrics.ts              Aggregations for dashboard/summary; dashboard periods + chart buckets
    settings.ts defaults.ts Per-owner settings with workflow defaults
    dates.ts types.ts
scripts/
  migrate-multi-user.mjs    One-time: stamp pre-multi-user docs with an owner
```

## Auth (optional, env-gated)

`authEnabled` (in `src/auth.config.ts`; `src/proxy.ts` inlines the same check) is true only when `AUTH_SECRET`, `AUTH_ATLASSIAN_ID` and
`AUTH_ATLASSIAN_SECRET` are all set. When off, the app is open and all data belongs to the
pseudo-owner `"local"`.

When on:

- The Atlassian provider requests scopes `read:me read:jira-work read:jira-user offline_access`
  with `prompt=consent` — consent reappears on every login **by design**; it is what guarantees
  a refresh token.
- The login doubles as the Jira credential: the access token is used as a Bearer token against
  `api.atlassian.com/ex/jira/{cloudId}`, with the site resolved from `accessible-resources`
  (matched against `JIRA_BASE_URL`).
- The allowlist is `ALLOWED_EMAILS`, falling back to `JIRA_EMAIL`. Rejection happens in the
  `signIn` callback, after Atlassian authenticates.

### Identity: accountId, never `token.sub`

**The most important invariant in the codebase.** Auth.js v5 without a database adapter mints a
**random UUID** as `token.sub` on every sign-in. It is not stable and must never be used as an
identity. The stable identity is the Atlassian `account_id`, captured in the `jwt` callback from
the sign-in profile (with a fallback fetch to `https://api.atlassian.com/me`). It is stored on
the JWT as `accountId` and exposed as `session.accountId`.

Three places must agree on "signed in means a JWT **with an accountId**", or the app
redirect-loops between `/` and `/login`:

1. `src/proxy.ts` — lets a request through only when the JWT has `accountId`
2. `src/app/login/page.tsx` — redirects to `/` only when `session.accountId` is present
3. `src/lib/owner.ts` — returns `accountId` or `null` (401), never a fallback to `sub`

A legacy JWT without `accountId` is treated as signed-out everywhere.

### Jira credential resolution

`resolveJiraAuth` in `src/lib/jira-auth.ts` tries, in order:

1. The signed-in user's OAuth tokens from the token store (refreshing if expired — see next
   section)
2. `JIRA_EMAIL` + `JIRA_API_TOKEN` Basic auth from env

The env fallback keeps headless/local use working, but it also **masks OAuth failures** in
development: if refresh breaks, syncs still pass via the env token. When testing OAuth paths,
check `/api/status` for `authError` instead of trusting a green sync.

### Token refresh

Atlassian access tokens expire after ~1 hour. Refresh tokens are **rotating and single-use**:
every refresh returns a new refresh token and invalidates the old one. Replaying a consumed
refresh token kills the whole chain — Atlassian then rejects everything until the user signs
in again.

So the tokens cannot live in the session cookie: many request paths (server components, most
API routes) can't rewrite it, and a lost rotation means the next refresh replays a dead token.
Instead `src/lib/token-store.ts` keeps them in the `oauthTokens` collection (`_id` =
accountId); the cookie carries only `accountId`, `cloudId`, `siteUrl` and an `error` flag.

- **Sign-in** (`jwt` callback with `account`): `saveTokens` replaces the stored chain.
- **Use**: `getUsableTokens(accountId)` returns an unexpired set; when expired (60 s skew) it
  refreshes through a per-account in-flight promise, re-reads the doc first (someone may have
  just refreshed), and writes the rotated pair back conditionally on the consumed token.
- **Failure**: a 4xx from the token endpoint marks the doc `dead` (unless a newer pair already
  landed) so it is never replayed; only a new sign-in revives it. Network/5xx errors throw and
  are retried on the next call.
- **`authError`** is recomputed from the store on every session read, so it clears by itself
  once the chain works again.

The in-flight de-dup is per process. Two server instances refreshing the same account at the
same instant could still race; the conditional write plus the re-read on rejection limits the
damage, but a multi-instance deployment would want a Mongo lease around the refresh.

## Multi-user data model

Every document in every collection carries an `owner` field:

- `owner` = Atlassian `accountId` when auth is on
- `owner` = `"local"` (`LOCAL_OWNER` in `src/lib/owner.ts`) when auth is off

Collections and their indexes (created in `src/lib/mongo.ts`):

| Collection  | Keying                                              |
| ----------- | --------------------------------------------------- |
| `tickets`   | unique `{owner, key}`                               |
| `events`    | unique `{owner, ticketKey, type, at}` + `{owner, at}` |
| `goals`     | `{owner, createdAt: -1}`                            |
| `settings`  | `_id` = owner (one doc per owner)                   |
| `syncState` | `_id` = owner                                       |
| `oauthTokens` | `_id` = Atlassian accountId (auth on only)        |

Rules that keep this safe:

- **Every** filter, write and upsert includes `owner`. No exceptions.
- API routes resolve the owner once via `resolveOwner(req)` and 401 when it is `null`
  (`/api/status` is the one route that never 401s — the proxy skips it and it reports auth
  state instead, revealing nothing else to signed-out callers).
- Sync in-flight de-duplication is per-owner (`Map<owner, Promise>` in `src/lib/sync.ts`).

## Sync engine (`src/lib/sync.ts`)

1. **Candidates**: one JQL search for tickets where the user is assignee **or** set the
   analysis/resolution "...By" fields (field ids from settings). Incremental runs restrict by
   `updated >= scannedUpdatedAt` from `syncState`.
2. **Changelog scan**: per candidate ticket, page through the changelog (oldest first) and
   derive events. Events are **first-occurrence-only** per `{ticket, type}` — editing a field
   ten times is one event — and are upserted idempotently (the unique index enforces this).
3. **Event semantics** (see README "fine print"): *pregroomed* = first changelog entry where
   the user set the analysis field; *sent to testing* = first entry where the user set the
   resolution field; *QA bounce* = any testing→rework status transition, any author. The
   **changelog author** is the truth, not "...By" field values (automations write those).
4. **isMine reconciliation**: after upserts, one unbounded `assignee = currentUser()` search
   rebuilds the `isMine` flag ($nin unmark, $in mark). Never blanket-clear `isMine` and re-mark
   from the incremental batch — the batch misses unchanged assigned tickets (this was a real
   bug; My Tickets showed 2 of 34).
5. **Triggers**: `Shell.tsx` fires a sync when the data is >15 minutes stale; Settings has a
   manual button. An interrupted **first** sync leaves `syncState` behind and makes later runs
   incremental over a hole — recovery is deleting the owner's `syncState` + `tickets` + `events`
   docs and re-syncing (goals are untouched).

## Frontend conventions

- Next 16 `cacheComponents` is on: **no** `export const dynamic = "force-dynamic"`, and no
  render-time `new Date()` in client components (hydration mismatch) — gate it on
  `useMounted()` rather than setting state in an effect. Data flows through the owner-scoped
  API routes and `useData`.
- Design: "Morning Press" editorial look — paper `#F6F0E3`, ink `#2A2014`, burnt orange accent
  `#C2551F` (deep `#A84314`), hairline rules instead of cards, Fraunces light numerals, flat
  woodcut sun motif. **No gradients, no rounded corners on the sidebar panel.** Tokens live in
  `src/app/globals.css`.
- Brand: **jiramorning** (renamed from Devfolio). `components/Brand.tsx` draws the rising-sun
  mark + wordmark; `app/icon.svg` is the favicon (exempted in the proxy matcher, or signed-out
  pages would get a login redirect for it). Internal names deliberately still say `devfolio`:
  the default Mongo database (renaming it would orphan existing data), the `devfolio:synced`
  window event, the `_devfolioMongo` global, and the GitHub repo.
- Sidebar nav (`Shell.tsx`, `.nav*` in `globals.css`): one `.nav-indicator` element slides to
  the item marked `data-active` (measured in a layout effect), moving on click rather than after
  the route loads; hover/press are pure CSS. Honors `prefers-reduced-motion`.
- GSAP `Reveal`/`CountUp` wrap content; note they leave DOM present but visually hidden until
  the animation runs (affects headless testing — query the DOM, don't screenshot).

## Dev gotchas

- Next dev server shows `Jest worker encountered N child process exceptions` or wedges after
  big CSS changes → kill the node PID listening on :3000, `rm -rf .next`, start fresh.
- `.env.local` holds every secret (Jira token, Mongo URI, AUTH_* vars). It is gitignored; keep
  it that way — scripts that need it (e.g. `scripts/migrate-multi-user.mjs`) parse the file
  themselves rather than printing values.
- `AGENTS.md` is auto-written by `next dev`; commit its changes rather than fighting them.
