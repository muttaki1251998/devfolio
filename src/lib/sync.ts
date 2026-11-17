import { getChangelog, getMyself, searchJql, JiraIssue } from "./jira";
import { ensureIndexes, getDb } from "./mongo";
import { loadSettings } from "./settings";
import { AppSettings, MetricEventDoc, SyncStateDoc, TicketDoc } from "./types";

const SYNC_ID = "sync";
let syncInFlight: Promise<SyncResult> | null = null;

export interface SyncResult {
  ok: boolean;
  scanned: number;
  tickets: number;
  newEvents: number;
  error?: string;
  at: string;
}

export async function getSyncState(): Promise<SyncStateDoc | null> {
  const db = await getDb();
  return db.collection<SyncStateDoc>("syncState").findOne({ _id: SYNC_ID });
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function toTicketDoc(issue: JiraIssue, s: AppSettings, myAccountId: string): TicketDoc {
  const f = issue.fields;
  const statusObj = f.status as { name?: string; statusCategory?: { name?: string } } | undefined;
  const assignee = f.assignee as { accountId?: string } | null | undefined;
  return {
    key: issue.key,
    summary: str(f.summary),
    status: statusObj?.name || "",
    statusCategory: statusObj?.statusCategory?.name || "",
    issueType: str((f.issuetype as { name?: string } | undefined)?.name),
    priority: str((f.priority as { name?: string } | undefined)?.name) || null,
    storyPoints: num(f[s.storyPointsFieldId]),
    isMine: assignee?.accountId === myAccountId,
    jiraUpdatedAt: str(f.updated),
    jiraCreatedAt: str(f.created),
  };
}

/**
 * Scan one ticket's changelog for the signals that drive every metric:
 *  - pregroomed: first change of the analysis field authored by the user
 *  - sent_to_testing: first change of the resolution field authored by the user
 *  - qa_bounce: every testingStatus -> reworkStatus transition (any author)
 * The author of the *field change itself* is the source of truth; the "...By"
 * fields are only used to find candidate tickets, since automations sometimes
 * write them on the author's behalf.
 */
async function scanTicket(
  key: string,
  s: AppSettings,
  myAccountId: string,
): Promise<{ events: MetricEventDoc[]; statusSince: string | null }> {
  const entries = await getChangelog(key);
  const events: MetricEventDoc[] = [];
  let pregroomed = false;
  let sent = false;
  let statusSince: string | null = null;

  for (const entry of entries) {
    const mine = entry.author?.accountId === myAccountId;
    for (const item of entry.items) {
      if (!pregroomed && mine && item.fieldId === s.analysisFieldId) {
        pregroomed = true;
        events.push({ ticketKey: key, type: "pregroomed", at: entry.created });
      }
      if (!sent && mine && item.fieldId === s.resolutionFieldId) {
        sent = true;
        events.push({ ticketKey: key, type: "sent_to_testing", at: entry.created });
      }
      if (item.field === "status") {
        statusSince = entry.created;
        if (item.fromString === s.testingStatus && item.toString === s.reworkStatus) {
          events.push({ ticketKey: key, type: "qa_bounce", at: entry.created });
        }
      }
    }
  }
  return { events, statusSince };
}

async function doSync(): Promise<SyncResult> {
  const db = await getDb();
  await ensureIndexes(db);
  const s = await loadSettings();
  const state = (await getSyncState()) || ({ _id: SYNC_ID } as SyncStateDoc);

  let accountId = state.accountId;
  let displayName = state.displayName;
  if (!accountId) {
    const me = await getMyself();
    accountId = me.accountId;
    displayName = me.displayName;
  }

  // Candidates: tickets I analysed, tickets I resolved, and tickets assigned
  // to me. Incremental after the first full scan.
  const cfNum = (id: string) => id.replace(/^customfield_/, "");
  let jql =
    `(assignee = currentUser()` +
    ` OR cf[${cfNum(s.analysisByFieldId)}] = currentUser()` +
    ` OR cf[${cfNum(s.resolutionByFieldId)}] = currentUser())`;
  if (state.fullScanDone && state.lastSyncAt) {
    const since = new Date(new Date(state.lastSyncAt).getTime() - 10 * 60_000);
    const y = since.getFullYear();
    const mo = String(since.getMonth() + 1).padStart(2, "0");
    const d = String(since.getDate()).padStart(2, "0");
    const h = String(since.getHours()).padStart(2, "0");
    const mi = String(since.getMinutes()).padStart(2, "0");
    jql += ` AND updated >= "${y}-${mo}-${d} ${h}:${mi}"`;
  }
  jql += " ORDER BY updated DESC";

  const fields = [
    "summary",
    "status",
    "issuetype",
    "assignee",
    "priority",
    "updated",
    "created",
    s.storyPointsFieldId,
  ];
  const issues = await searchJql(jql, fields);

  const tickets = db.collection<TicketDoc>("tickets");
  const eventsCol = db.collection<MetricEventDoc>("events");
  let scanned = 0;
  let newEvents = 0;

  // Assignment can move away, so clear isMine before re-marking current ones.
  if (issues.length) await tickets.updateMany({ isMine: true }, { $set: { isMine: false } });

  for (const issue of issues) {
    const doc = toTicketDoc(issue, s, accountId!);
    const existing = await tickets.findOne({ key: doc.key });
    const needsScan = !existing || existing.scannedUpdatedAt !== doc.jiraUpdatedAt;

    if (needsScan) {
      scanned++;
      const { events, statusSince } = await scanTicket(doc.key, s, accountId!);
      doc.statusSince = statusSince;
      doc.scannedUpdatedAt = doc.jiraUpdatedAt;
      for (const ev of events) {
        const res = await eventsCol.updateOne(
          { ticketKey: ev.ticketKey, type: ev.type, at: ev.at },
          { $setOnInsert: ev },
          { upsert: true },
        );
        if (res.upsertedCount) newEvents++;
      }
    } else {
      doc.statusSince = existing.statusSince;
      doc.scannedUpdatedAt = existing.scannedUpdatedAt;
    }
    await tickets.updateOne({ key: doc.key }, { $set: doc }, { upsert: true });
  }

  const at = new Date().toISOString();
  const result: SyncResult = { ok: true, scanned, tickets: issues.length, newEvents, at };
  await db.collection<SyncStateDoc>("syncState").updateOne(
    { _id: SYNC_ID },
    {
      $set: {
        lastSyncAt: at,
        lastSyncResult: `${issues.length} tickets, ${scanned} scanned, ${newEvents} new events`,
        accountId,
        displayName,
        fullScanDone: true,
      },
    },
    { upsert: true },
  );
  return result;
}

/** Runs a sync; concurrent callers share the in-flight run. */
export async function runSync(opts?: { ifStaleMinutes?: number }): Promise<SyncResult> {
  if (opts?.ifStaleMinutes) {
    const state = await getSyncState();
    if (state?.lastSyncAt) {
      const ageMin = (Date.now() - new Date(state.lastSyncAt).getTime()) / 60_000;
      if (ageMin < opts.ifStaleMinutes) {
        return { ok: true, scanned: 0, tickets: 0, newEvents: 0, at: state.lastSyncAt };
      }
    }
  }
  if (!syncInFlight) {
    syncInFlight = doSync()
      .catch((e: unknown): SyncResult => {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, scanned: 0, tickets: 0, newEvents: 0, error: msg, at: new Date().toISOString() };
      })
      .finally(() => {
        syncInFlight = null;
      });
  }
  return syncInFlight;
}
