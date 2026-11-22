import {
  addDays,
  addMonths,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from "./dates";
import { getDb } from "./mongo";
import { loadSettings } from "./settings";
import { EventRow, MetricCounts, MetricEventDoc, MetricEventType, TicketDoc } from "./types";

export const PERIODS = ["week", "month", "quarter", "year", "ytd", "all"] as const;
/** `year` is the rolling last 12 months; `ytd` starts on January 1. */
export type Period = (typeof PERIODS)[number];
/** Week → a bar per day, month → per week, anything longer → per month. */
export type Granularity = "day" | "week" | "month";

export function isPeriod(p: string | null): p is Period {
  return !!p && (PERIODS as readonly string[]).includes(p);
}

function periodStart(period: "week" | "month", weekStartsMonday: boolean): Date {
  const now = new Date();
  return period === "week" ? startOfWeek(now, weekStartsMonday) : startOfMonth(now);
}

/**
 * The range a period covers and how the chart splits it: a bar per day for the week, per
 * week for the month, and per month for everything longer. Calendar periods (week, month,
 * quarter) run to their end so the chart shows how far through them you are; the others
 * run to now.
 */
function periodWindow(
  period: Period,
  weekStartsMonday: boolean,
  now: Date,
): { start: Date | null; end: Date; granularity: Granularity } {
  switch (period) {
    case "week": {
      const start = startOfWeek(now, weekStartsMonday);
      return { start, end: addDays(start, 7), granularity: "day" };
    }
    case "month": {
      const start = startOfMonth(now);
      return { start, end: addMonths(start, 1), granularity: "week" };
    }
    case "quarter": {
      const start = startOfQuarter(now);
      return { start, end: addMonths(start, 3), granularity: "month" };
    }
    case "year":
      return { start: addMonths(startOfMonth(now), -11), end: now, granularity: "month" };
    case "ytd":
      return { start: startOfYear(now), end: now, granularity: "month" };
    case "all":
      return { start: null, end: now, granularity: "month" };
  }
}

/** Bucket start dates from `from` until `end`; week buckets snap to week boundaries. */
function bucketStarts(from: Date, end: Date, g: Granularity, weekStartsMonday: boolean): Date[] {
  const out: Date[] = [];
  let cur = g === "month" ? startOfMonth(from) : startOfDay(from);
  while (cur < end) {
    out.push(cur);
    cur =
      g === "day"
        ? addDays(cur, 1)
        : g === "week"
          ? addDays(startOfWeek(cur, weekStartsMonday), 7)
          : addMonths(cur, 1);
  }
  return out;
}

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", o);

function bucketLabel(d: Date, g: Granularity, now: Date): string {
  const yy = `’${String(d.getFullYear()).slice(2)}`;
  const otherYear = d.getFullYear() !== now.getFullYear();
  if (g === "day") return `${fmt(d, { weekday: "short" })} ${d.getDate()}`;
  if (g === "week") return fmt(d, { month: "short", day: "numeric" });
  return otherYear ? `${fmt(d, { month: "short" })} ${yy}` : fmt(d, { month: "short" });
}

function bucketRange(start: Date, end: Date, g: Granularity): string {
  if (g === "day") return fmt(start, { weekday: "long", month: "short", day: "numeric" });
  if (g === "month") return fmt(start, { month: "long", year: "numeric" });
  const last = addDays(end, -1);
  return `${fmt(start, { month: "short", day: "numeric" })} – ${fmt(last, { month: "short", day: "numeric", year: "numeric" })}`;
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

export async function eventsSince(
  owner: string,
  since: Date | null,
  limit = 1000,
): Promise<EventRow[]> {
  const db = await getDb();
  const filter = since ? { owner, at: { $gte: since.toISOString() } } : { owner };
  let cursor = db.collection<MetricEventDoc>("events").find(filter).sort({ at: -1 });
  if (limit > 0) cursor = cursor.limit(limit);
  const events = await cursor.toArray();
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

export interface SeriesPoint {
  label: string;
  /** Human-readable span, for the tooltip. */
  range: string;
  start: string;
  pregroomed: number;
  sentToTesting: number;
  qaBounces: number;
  /** Bucket starts after now (later days/weeks of the current week, month or quarter). */
  future: boolean;
}

export async function dashboardData(owner: string, period: Period) {
  const settings = await loadSettings(owner);
  const now = new Date();
  let firstEventAt: Date | null = null;
  if (period === "all") {
    const db = await getDb();
    const first = await db
      .collection<MetricEventDoc>("events")
      .find({ owner })
      .sort({ at: 1 })
      .limit(1)
      .next();
    firstEventAt = first ? new Date(first.at) : null;
  }
  const { start, end, granularity } = periodWindow(
    period,
    settings.weekStartsMonday,
    now,
  );

  // Unlimited: counts and the chart must see every event in the range, not the newest 1000.
  const rows = await eventsSince(owner, start, 0);
  const counts = countRows(rows);

  const starts = bucketStarts(start ?? firstEventAt ?? now, end, granularity, settings.weekStartsMonday);
  const series: SeriesPoint[] = starts.map((bs, i) => {
    const be = starts[i + 1] ?? end;
    const inBucket = rows.filter((r) => {
      const at = new Date(r.at);
      return at >= bs && at < be;
    });
    return {
      label: bucketLabel(bs, granularity, now),
      range: bucketRange(bs, be, granularity),
      start: bs.toISOString(),
      pregroomed: inBucket.filter((r) => r.type === "pregroomed").length,
      sentToTesting: inBucket.filter((r) => r.type === "sent_to_testing").length,
      qaBounces: inBucket.filter((r) => r.type === "qa_bounce").length,
      future: bs > now,
    };
  });

  return {
    counts,
    rows: rows.slice(0, 200),
    totalEvents: rows.length,
    series,
    granularity,
    period,
    range: { start: (start ?? starts[0] ?? now).toISOString(), end: end.toISOString() },
  };
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
