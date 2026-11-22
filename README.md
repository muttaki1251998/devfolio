# ☀ Devfolio

**Look at it before standup.** A personal, self-hosted dashboard for the work you actually do in Jira — counted from the ticket changelog, not from whoever's name happens to be on a field.

Devfolio greets you in the morning, shows what moved since yesterday, drafts your standup, and keeps honest weekly/monthly counts of the two things most workflows never surface:

- **Pregroomed** — the first time *you* set the analysis field on a ticket
- **Sent to testing** — the first time *you* set the resolution field

Both are read from Jira's changelog, so automation writing "...By" fields on your behalf doesn't skew anything, and tickets that skip workflow statuses still count. QA bounces (testing → rework transitions) are tracked separately.

## Screens

- **Home** — good-morning greeting, what changed since yesterday, a drafted standup with a copy button, your board at a glance, and tickets going stale
- **My Tickets** — open tickets assigned to you, grouped by status, with days-in-status aging
- **Dashboard** — week / month / to-date counts, story points, clean-handoff rate, a 12-week chart, and the ticket-level events behind every number
- **Goals** — manual check-off goals, plus auto goals tied to metrics ("Pregroom 10 tickets this week" fills itself in)
- **Settings** — every field id and status name is editable, so Devfolio adapts to any team's workflow

## Stack

Next.js (App Router) · MongoDB · GSAP · Recharts · Tailwind CSS. One app, no separate backend: API routes talk to Jira's REST API with your own Atlassian login or API token and cache everything in your own MongoDB, so pages load instantly.

## Setup

1. **Clone and install**

   ```bash
   git clone <this repo> && cd devfolio
   npm install
   ```

2. **Create `.env.local`** (see `.env.example`):

   ```ini
   JIRA_BASE_URL=https://yourteam.atlassian.net
   JIRA_EMAIL=you@company.com
   JIRA_API_TOKEN=...   # id.atlassian.com → Security → Create API token
   MONGODB_URI=...      # MongoDB Atlas free tier, or mongodb://localhost:27017
   ```

   Your token stays in this local file. It is never rendered in the UI and `.env*` is gitignored.

3. **Run**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000. The first sync scans the changelog of every candidate ticket (ones you analysed, resolved, or are assigned), which can take a minute on a long history; after that, syncs are incremental and run automatically every 15 minutes while the app is open.

4. **Point it at your workflow** on the Settings screen: the analysis/resolution field ids, the story points field, your board's status names, and what counts as a QA bounce. Defaults match an Analysis Results / Resolution Details workflow.

### Finding your field ids

Open any ticket and visit `https://yourteam.atlassian.net/rest/api/3/issue/TICKET-123?expand=names` — the `names` block maps every `customfield_*` id to its display name.

## How counting works (the fine print)

- A ticket counts **once** per metric, at the first qualifying changelog entry — editing the field ten times is still one pregroom.
- The **author of the field change** is what counts, not field values. A ticket you pregroomed that an automation later touched is still yours; a ticket someone else pregroomed never becomes yours.
- **QA bounces** count every testing → rework transition, by any author, on candidate tickets.
- Devfolio stores only ticket key, summary, status, type, points and timestamps — no descriptions, comments or attachments.

## Login with Atlassian (optional)

By default Devfolio has no sign-in: anyone who can reach the server sees the dashboard. That is fine on localhost. To put it behind "Log in with Atlassian" (OAuth 2.0 3LO), set the variables below in `.env.local` and restart. Login turns on only when `AUTH_SECRET`, `AUTH_ATLASSIAN_ID` and `AUTH_ATLASSIAN_SECRET` are all set; otherwise the app behaves exactly as before and the Log out button stays hidden.

The same login is the Jira credential: the OAuth token is kept in the encrypted session cookie on the server, refreshed automatically, and used for every Jira read, so signed-in users never need a Jira API token.

1. **Create the app**: at developer.atlassian.com open the Developer console and create an "OAuth 2.0 integration".
2. **Permissions**: add the Jira API and grant the scopes `read:jira-work` and `read:jira-user`. Login also requests `read:me` and `offline_access` (needed to keep the session refreshed).
3. **Authorization**: under OAuth 2.0 (3LO) set the callback URL to `http://localhost:3000/api/auth/callback/atlassian` (plus your deployed origin if you host it).
4. **Env vars**: copy the Client ID and Secret from Settings into `AUTH_ATLASSIAN_ID` and `AUTH_ATLASSIAN_SECRET`. Set `AUTH_SECRET` with `npx auth secret` (or `openssl rand -base64 32`).
5. **Site**: set `JIRA_BASE_URL` (recommended) so the login picks the right Jira site. If it is unset and your account can access exactly one site, that site is used.
6. **Allowlist**: set `ALLOWED_EMAILS` to a comma-separated list (case-insensitive). If it is unset, only `JIRA_EMAIL` may sign in. Any other account is rejected at the login page, even if it authenticates successfully with Atlassian.

When login is on, every page and API route except `/login` and `/api/auth/*` requires a session. A sync uses the signed-in user's token first and falls back to `JIRA_EMAIL` plus `JIRA_API_TOKEN` when those are set, so the env API token remains a supported headless option (and the only option when login is off).

## Privacy

Self-hosted by design. With login on, each person signs in with their own Atlassian account and sees only their own data: tickets, events, goals and settings are stored per Atlassian account in a MongoDB you control, alongside each user's OAuth tokens. An env API token, if you use one, stays in `.env.local` on your server. Nothing is sent anywhere except your Jira site and Atlassian's auth endpoints.

## Roadmap

- Wins log / monthly export for review season
- An AI assistant that answers "what did I ship in March?"
- Multi-site support

PRs welcome.

## License

MIT
