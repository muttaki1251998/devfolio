"use client";

import { useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import CountUp from "@/components/CountUp";
import Reveal from "@/components/Reveal";
import SetupCard from "@/components/SetupCard";
import TicketLink from "@/components/TicketLink";
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
  { id: "all", label: "All time" },
] as const;

const EVENT_LABEL: Record<string, string> = {
  pregroomed: "Pregroomed",
  sent_to_testing: "Sent to test",
  qa_bounce: "QA bounce",
};

const TH =
  "border-b border-rule py-3.5 pr-6 text-left text-xs font-semibold uppercase tracking-[0.1em] text-muted";

function whenLabel(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
  return `${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
}

export default function DashboardPage() {
  const status = useStatus();
  const [period, setPeriod] = useState<"week" | "month" | "all">("week");
  const { data } = useJson<Payload>(status?.configured ? `/api/metrics?period=${period}` : null);

  if (status && !status.configured) {
    return <SetupCard env={status.env} mongoOk={status.mongoOk} />;
  }

  const cleanRate =
    data && data.counts.sentToTesting > 0
      ? Math.round(
          (100 * Math.max(data.counts.sentToTesting - data.counts.qaBounces, 0)) /
            data.counts.sentToTesting,
        )
      : undefined;

  return (
    <Reveal className="max-w-[1100px]">
      <div data-reveal className="flex flex-wrap items-baseline gap-x-10 gap-y-3">
        <h1 className="font-serif text-[44px] font-normal leading-tight tracking-[-0.02em]">Dashboard</h1>
        <div role="group" aria-label="Period" className="flex gap-[22px]">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`cursor-pointer border-b-2 bg-transparent pb-[3px] text-sm ${
                period === p.id
                  ? "border-accent font-semibold text-ink"
                  : "border-transparent font-medium text-muted hover:text-deep"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div data-reveal className="mt-9 flex flex-wrap border-y border-hairline">
        <Stat
          label={`Pregroomed · ${data?.counts.pregroomedPoints ?? 0} pts`}
          value={data?.counts.pregroomed}
          first
        />
        <Stat
          label={`Sent to testing · ${data?.counts.sentPoints ?? 0} pts`}
          value={data?.counts.sentToTesting}
        />
        <Stat label="QA bounces" value={data?.counts.qaBounces} />
        <Stat label="Clean handoff rate" value={cleanRate} suffix="%" accent />
      </div>

      <section data-reveal className="mt-14">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-serif text-2xl font-medium">Last 12 weeks</h2>
          <div className="flex gap-5 text-[13px] text-muted">
            <span>
              <span aria-hidden className="mr-[7px] inline-block h-2.5 w-2.5 rounded-[2px] bg-accent" />
              Pregroomed
            </span>
            <span>
              <span aria-hidden className="mr-[7px] inline-block h-2.5 w-2.5 rounded-[2px] bg-barsoft" />
              Sent to testing
            </span>
          </div>
        </div>
        <div className="mt-7 h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.series ?? []} barGap={5} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fill: "#6e6250", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "#d8ccb4" }}
                tickMargin={10}
              />
              <YAxis hide allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "rgba(216, 204, 180, 0.25)" }}
                contentStyle={{
                  background: "#fbf6ea",
                  border: "1px solid #e5dbc7",
                  borderRadius: 4,
                  boxShadow: "none",
                  fontSize: 13,
                  color: "#2a2014",
                }}
              />
              <Bar dataKey="pregroomed" name="Pregroomed" fill="#c2551f" barSize={16} radius={[3, 3, 0, 0]} />
              <Bar
                dataKey="sentToTesting"
                name="Sent to testing"
                fill="#b4a88e"
                barSize={16}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section data-reveal className="mt-16">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl font-medium">Recent events</h2>
          <span className="text-[13px] text-muted">{data?.rows.length ?? 0} events</span>
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr>
                <th className={TH}>Event</th>
                <th className={TH}>Ticket</th>
                <th className={TH}>Summary</th>
                <th className={`${TH} !text-right`}>Pts</th>
                <th className={`${TH} !pr-0 !text-right`}>When</th>
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((r) => (
                <tr key={`${r.ticketKey}-${r.type}-${r.at}`} className="border-b border-divider last:border-b-0">
                  <td
                    className={`whitespace-nowrap py-3.5 pr-6 text-xs font-semibold uppercase tracking-[0.06em] ${
                      r.type === "qa_bounce" ? "text-bounce" : "text-deep"
                    }`}
                  >
                    {EVENT_LABEL[r.type]}
                  </td>
                  <td className="whitespace-nowrap py-3.5 pr-6 font-semibold">
                    <TicketLink status={status} ticket={r.ticketKey} />
                  </td>
                  <td className="max-w-sm truncate py-3.5 pr-6 text-standup">{r.summary}</td>
                  <td className="py-3.5 pr-6 text-right text-muted">{r.storyPoints ?? "—"}</td>
                  <td className="whitespace-nowrap py-3.5 text-right text-muted">{whenLabel(r.at)}</td>
                </tr>
              ))}
              {data && !data.rows.length && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">
                    No events in this period yet. Sync, or widen the period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </Reveal>
  );
}

function Stat({
  label,
  value,
  suffix,
  accent,
  first,
}: {
  label: string;
  value?: number;
  suffix?: string;
  accent?: boolean;
  first?: boolean;
}) {
  return (
    <div className={`flex-[1_1_200px] py-7 ${first ? "pr-8" : "border-l border-hairline px-8"}`}>
      <div className={`font-serif text-[52px] font-light leading-none ${accent ? "text-accent" : ""}`}>
        {value === undefined ? "–" : <CountUp value={value} />}
        {value !== undefined && suffix}
      </div>
      <div className="mt-2 text-[13px] font-medium text-muted">{label}</div>
    </div>
  );
}
