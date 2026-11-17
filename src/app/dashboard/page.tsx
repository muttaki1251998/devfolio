"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import CountUp from "@/components/CountUp";
import Reveal from "@/components/Reveal";
import SetupCard from "@/components/SetupCard";
import { useJson, useStatus } from "@/components/useData";
import type { EventRow, MetricCounts } from "@/lib/types";

interface WeeklyPoint {
  label: string;
  pregroomed: number;
  sentToTesting: number;
}

interface Payload {
  counts: MetricCounts;
  rows: EventRow[];
  series: WeeklyPoint[];
  period: string;
}

const PERIODS = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "To date" },
] as const;

const EVENT_LABEL: Record<string, string> = {
  pregroomed: "Pregroomed",
  sent_to_testing: "Sent to testing",
  qa_bounce: "QA bounce",
};

export default function DashboardPage() {
  const status = useStatus();
  const [period, setPeriod] = useState<"week" | "month" | "all">("week");
  const { data } = useJson<Payload>(status?.configured ? `/api/metrics?period=${period}` : null);

  if (status && !status.configured) {
    return <SetupCard env={status.env} mongoOk={status.mongoOk} />;
  }

  return (
    <Reveal className="max-w-5xl">
      <div data-reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-soft">The work, counted the way it actually happened.</p>
        </div>
        <div className="flex rounded-xl border border-line bg-raised p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                period === p.id ? "bg-wash font-semibold text-accent-deep" : "text-soft hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pregroomed" value={data?.counts.pregroomed} sub={`${data?.counts.pregroomedPoints ?? 0} pts`} />
        <Stat label="Sent to testing" value={data?.counts.sentToTesting} sub={`${data?.counts.sentPoints ?? 0} pts`} />
        <Stat label="QA bounces" value={data?.counts.qaBounces} sub="rework loops" />
        <Stat
          label="Clean handoff rate"
          value={
            data && data.counts.sentToTesting > 0
              ? Math.round(
                  (100 * Math.max(data.counts.sentToTesting - data.counts.qaBounces, 0)) /
                    data.counts.sentToTesting,
                )
              : undefined
          }
          suffix="%"
          sub="sent minus bounces"
        />
      </div>

      <section data-reveal className="card mt-5 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Last 12 weeks</h2>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.series ?? []} barGap={2}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="label" tick={{ fill: "var(--ink-faint)", fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} width={28} tick={{ fill: "var(--ink-faint)", fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: "var(--bg-sunken)" }}
                contentStyle={{
                  background: "var(--bg-raised)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  fontSize: 13,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="pregroomed" name="Pregroomed" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="sentToTesting" name="Sent to testing" fill="var(--ink-soft)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section data-reveal className="card mt-5 overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">
            Behind the numbers
          </h2>
          <span className="text-xs text-faint">{data?.rows.length ?? 0} events</span>
        </div>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
              <th className="px-6 py-2 font-semibold">When</th>
              <th className="px-3 py-2 font-semibold">Event</th>
              <th className="px-3 py-2 font-semibold">Ticket</th>
              <th className="px-3 py-2 font-semibold">Summary</th>
              <th className="px-6 py-2 text-right font-semibold">Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data?.rows.map((r) => (
              <tr key={`${r.ticketKey}-${r.type}-${r.at}`}>
                <td className="whitespace-nowrap px-6 py-2.5 text-faint">
                  {new Date(r.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`chip ${r.type === "qa_bounce" ? "!bg-wash !text-accent-deep" : ""}`}>
                    {EVENT_LABEL[r.type]}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-semibold">{r.ticketKey}</td>
                <td className="max-w-sm truncate px-3 py-2.5 text-soft">{r.summary}</td>
                <td className="px-6 py-2.5 text-right text-faint">{r.storyPoints ?? "–"}</td>
              </tr>
            ))}
            {data && !data.rows.length && (
              <tr>
                <td colSpan={5} className="px-6 py-6 text-center text-faint">
                  No events in this period yet. Sync, or widen the period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </Reveal>
  );
}

function Stat({
  label,
  value,
  sub,
  suffix,
}: {
  label: string;
  value?: number;
  sub?: string;
  suffix?: string;
}) {
  return (
    <div data-reveal className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-2 font-serif text-4xl font-semibold">
        {value === undefined ? "–" : <CountUp value={value} />}
        {value !== undefined && suffix}
      </p>
      {sub && <p className="mt-1 text-xs text-faint">{sub}</p>}
    </div>
  );
}
