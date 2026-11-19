import { addDays, startOfDay, startOfMonth, startOfWeek, weekLabel } from "./dates";
import { getDb } from "./mongo";
import { loadSettings } from "./settings";
import { EventRow, MetricCounts, MetricEventDoc, MetricEventType, TicketDoc } from "./types";

export type Period = "week" | "month" | "all";

function periodStart(period: Period, weekStartsMonday: boolean): Date | null {
  const now = new Date();
  if (period === "week") return startOfWeek(now, weekStartsMonday);
  if (period === "month") return startOfMonth(now);
  return null;
}

async function joinTickets(owner: string, events: MetricEventDoc[]): Promise<EventRow[]> {
  const db = await getDb();
  const keys = [...new Set(events.map((e) => e.ticketKey))];
  const tickets = await db
    .collection<TicketDoc>("tickets")
    .find({ owner, key: { $in: keys } })
    .toArray();
  const byKey = new Map(tickets.map((t) => [t.key, t]));
  return events.map((e) => {
    const t = byKey.get(e.ticketKey);
    return {
      ticketKey: e.ticketKey,
      type: e.type,
      at: e.at,
      summary: t?.summary,
      status: t?.status,
      storyPoints: t?.storyPoints ?? null,
    };
  });
}

export async function eventsSince(owner: string, since: Date | null): Promise<EventRow[]> {
  const db = await getDb();
  const filter = since ? { owner, at: { $gte: since.toISOString() } } : { owner };
  const events = await db
    .collection<MetricEventDoc>("events")
    .find(filter)
    .sort({ at: -1 })
    .limit(1000)
    .toArray();
  return joinTickets(owner, events);
}

export function countRows(rows: EventRow[]): MetricCounts {
  const counts: MetricCounts = {
    pregroomed: 0,
    sentToTesting: 0,
    qaBounces: 0,
    pregroomedPoints: 0,
    sentPoints: 0,
  };
  for (const r of rows) {
    if (r.type === "pregroomed") {
      counts.pregroomed++;
      counts.pregroomedPoints += r.storyPoints ?? 0;
    } else if (r.type === "sent_to_testing") {
      counts.sentToTesting++;
      counts.sentPoints += r.storyPoints ?? 0;
    } else if (r.type === "qa_bounce") {
      counts.qaBounces++;
    }
  }
  return counts;
}

export interface WeeklyPoint {
  label: string;
  weekStart: string;
  pregroomed: number;
  sentToTesting: number;
}

export async function dashboardData(owner: string, period: Period) {
  const settings = await loadSettings(owner);
  const since = periodStart(period, settings.weekStartsMonday);
  const rows = await eventsSince(owner, since);
  const counts = countRows(rows);

  // Last 12 weeks series, independent of the selected period.
  const now = new Date();
  const firstWeek = startOfWeek(addDays(now, -7 * 11), settings.weekStartsMonday);
  const allRecent = await eventsSince(owner, firstWeek);
  const series: WeeklyPoint[] = [];
  for (let i = 0; i < 12; i++) {
    const ws = addDays(firstWeek, i * 7);
    const we = addDays(ws, 7);
    const inWeek = allRecent.filter((r) => {
      const at = new Date(r.at);
      return at >= ws && at < we;
    });
    series.push({
      label: weekLabel(ws),
      weekStart: ws.toISOString(),
      pregroomed: inWeek.filter((r) => r.type === "pregroomed").length,
      sentToTesting: inWeek.filter((r) => r.type === "sent_to_testing").length,
    });
  }

  return { counts, rows: rows.slice(0, 200), series, period };
}

export async function countsForPeriod(
  owner: string,
  metric: MetricEventType,
  period: "week" | "month",
  weekStartsMonday: boolean,
): Promise<number> {
  const since = periodStart(period, weekStartsMonday)!;
  const db = await getDb();
  return db
    .collection<MetricEventDoc>("events")
    .countDocuments({ owner, type: metric, at: { $gte: since.toISOString() } });
}

export async function homeData(owner: string) {
  const settings = await loadSettings(owner);
  const db = await getDb();
  const sinceYesterday = addDays(startOfDay(new Date()), -1);

  const recentEvents = await eventsSince(owner, sinceYesterday);
  const myTickets = await db
    .collection<TicketDoc>("tickets")
    .find({ owner, isMine: true, statusCategory: { $ne: "Done" } })
    .sort({ jiraUpdatedAt: -1 })
    .toArray();

  const touched = myTickets.filter((t) => new Date(t.jiraUpdatedAt) >= sinceYesterday);
  const stale = myTickets.filter((t) => {
    if (!t.statusSince) return false;
    return (Date.now() - new Date(t.statusSince).getTime()) / 86_400_000 >= settings.staleAfterDays;
  });

  const byStatus: Record<string, number> = {};
  for (const t of myTickets) byStatus[t.status] = (byStatus[t.status] || 0) + 1;

  return {
    settings: { userName: settings.userName, boardStatuses: settings.boardStatuses },
    recentEvents,
    touched: touched.map((t) => ({ key: t.key, summary: t.summary, status: t.status })),
    stale: stale.map((t) => ({
      key: t.key,
      summary: t.summary,
      status: t.status,
      days: Math.floor((Date.now() - new Date(t.statusSince!).getTime()) / 86_400_000),
    })),
    byStatus,
    totalMine: myTickets.length,
  };
}
