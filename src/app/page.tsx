"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Reveal from "@/components/Reveal";
import SetupCard from "@/components/SetupCard";
import TicketLink from "@/components/TicketLink";
import { useJson, useStatus } from "@/components/useData";
import type { EventRow } from "@/lib/types";

interface Summary {
  settings: { userName: string; boardStatuses: string[] };
  recentEvents: EventRow[];
  touched: { key: string; summary: string; status: string }[];
  stale: { key: string; summary: string; status: string; days: number }[];
  byStatus: Record<string, number>;
  totalMine: number;
}

const EVENT_LABEL: Record<string, string> = {
  pregroomed: "Pregroomed",
  sent_to_testing: "Sent to test",
  qa_bounce: "QA bounce",
};

const STANDUP_LABEL: Record<string, string> = {
  pregroomed: "Pregroomed",
  sent_to_testing: "Sent to testing",
  qa_bounce: "Bounced back from QA",
};

function greeting(name: string, now: Date): string {
  const h = now.getHours();
  const part = h < 5 ? "Up early" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}` : part;
}

function whenLabel(iso: string, now: Date | null): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
  if (now && d.toDateString() === now.toDateString()) return time;
  return `${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
}

export default function HomePage() {
  const status = useStatus();
  const { data } = useJson<Summary>(status?.configured ? "/api/summary" : null);
  const [copied, setCopied] = useState(false);
  // Current time is read after mount so prerendering stays deterministic.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  const plan = useMemo(() => {
    if (!data) return null;
    const order = ["sent_to_testing", "pregroomed", "qa_bounce"] as const;
    const groups = order
      .map((type) => ({
        type,
        label: STANDUP_LABEL[type],
        keys: [...new Set(data.recentEvents.filter((e) => e.type === type).map((e) => e.ticketKey))].sort(),
      }))
      .filter((g) => g.keys.length);
    const worked = [
      ...new Set(
        data.touched
          .filter((t) => !data.recentEvents.some((e) => e.ticketKey === t.key))
          .map((t) => t.key),
      ),
    ].sort();
    const today = data.touched
      .slice(0, 5)
      .map((t) => ({ key: t.key, summary: t.summary, status: t.status }));
    return { groups, worked, today };
  }, [data]);

  const standup = useMemo(() => {
    if (!plan) return "";
    const lines = ["Yesterday:"];
    if (!plan.groups.length && !plan.worked.length) lines.push("- (nothing recorded)");
    for (const g of plan.groups) lines.push(`- ${g.label}: ${g.keys.join(", ")}`);
    if (plan.worked.length) lines.push(`- Worked on: ${plan.worked.join(", ")}`);
    lines.push("", "Today:");
    if (plan.today.length) {
      for (const t of plan.today) lines.push(`- Continue ${t.key} — ${t.summary}`);
    } else {
      lines.push("- Pick up the board");
    }
    lines.push("", "Blockers:", "- None");
    return lines.join("\n");
  }, [plan]);

  if (status && !status.configured) {
    return (
      <Reveal>
        <div data-reveal>
          <SetupCard env={status.env} mongoOk={status.mongoOk} />
        </div>
      </Reveal>
    );
  }

  const name = data?.settings.userName || status?.sync?.displayName?.split(" ")[0] || "";
  const dateStr = now
    ? now.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : " ";

  const moved = data
    ? data.touched.filter((t) => !data.recentEvents.some((e) => e.ticketKey === t.key)).slice(0, 6)
    : [];
  const count = (type: string) => (data ? data.recentEvents.filter((e) => e.type === type).length : 0);

  let summaryLine = "Warming up…";
  if (data) {
    const bits: string[] = [];
    if (count("pregroomed")) bits.push(`${count("pregroomed")} pregroomed`);
    if (count("sent_to_testing")) bits.push(`${count("sent_to_testing")} sent to testing`);
    if (count("qa_bounce")) bits.push(`${count("qa_bounce")} bounced back`);
    summaryLine = `${data.totalMine} ticket${data.totalMine === 1 ? "" : "s"} on your plate. ${
      bits.length ? `Since yesterday: ${bits.join(", ")}.` : "A quiet start — nothing has moved since yesterday."
    }`;
  }

  return (
    <Reveal className="max-w-[960px]">
      <p data-reveal className="eyebrow mb-3.5">
        {dateStr}
      </p>
      <h1
        data-reveal
        className="font-serif text-[40px] font-normal leading-[1.05] tracking-[-0.02em] sm:text-[64px]"
      >
        {now ? greeting(name, now) : " "}
        {now && <span className="text-accent">.</span>}
      </h1>
      <p data-reveal className="mt-[18px] max-w-[640px] text-[17px] text-muted">
        {summaryLine}
      </p>

      <section data-reveal className="mt-[52px]">
        <h2 className="mb-[18px] font-serif text-2xl font-medium">Since yesterday</h2>
        <ul className="border-t border-[#e6dac0]">
          {data?.recentEvents.map((e) => (
            <li
              key={`${e.ticketKey}-${e.type}-${e.at}`}
              className="flex items-baseline gap-3.5 border-b border-[#e6dac0] py-3.5"
            >
              <span
                className={`w-[118px] shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                  e.type === "qa_bounce" ? "text-bounce" : "text-deep"
                }`}
              >
                {EVENT_LABEL[e.type]}
              </span>
              <TicketLink status={status} ticket={e.ticketKey} className="whitespace-nowrap text-sm font-semibold" />
              <span className="min-w-0 truncate text-sm text-muted">{e.summary}</span>
              <span className="ml-auto shrink-0 text-[13px] text-muted">{whenLabel(e.at, now)}</span>
            </li>
          ))}
          {moved.map((t) => (
            <li key={t.key} className="flex items-baseline gap-3.5 border-b border-[#e6dac0] py-3.5">
              <span className="w-[118px] shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-deep">
                Moved
              </span>
              <TicketLink status={status} ticket={t.key} className="whitespace-nowrap text-sm font-semibold" />
              <span className="min-w-0 truncate text-sm text-muted">{t.summary}</span>
              <span className="ml-auto shrink-0 text-[13px] text-muted">{t.status}</span>
            </li>
          ))}
          {data && !data.recentEvents.length && !data.touched.length && (
            <li className="border-b border-[#e6dac0] py-3.5 text-sm text-muted">
              A quiet day. Nothing changed since yesterday.
            </li>
          )}
        </ul>
      </section>

      <div className="mt-[52px] flex flex-wrap gap-x-14 gap-y-12">
        <section data-reveal className="min-w-0 flex-[1_1_380px]">
          <div className="mb-[18px] flex items-baseline justify-between">
            <h2 className="font-serif text-2xl font-medium">Standup draft</h2>
            <button
              className="btn-link"
              onClick={() => {
                navigator.clipboard.writeText(standup).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="rounded-[4px] bg-inset px-[26px] py-6">
            {plan ? (
              <div className="flex flex-col gap-5 text-sm">
                <div>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Yesterday
                  </h3>
                  {plan.groups.length || plan.worked.length ? (
                    <ul className="flex flex-col gap-2">
                      {plan.groups.map((g) => (
                        <li key={g.type} className="flex gap-3">
                          <span
                            className={`w-[118px] shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                              g.type === "qa_bounce" ? "text-bounce" : "text-deep"
                            }`}
                          >
                            {g.label}
                          </span>
                          <span className="flex min-w-0 flex-wrap gap-x-1.5 leading-relaxed text-standup">
                            {g.keys.map((k, i) => (
                              <span key={k} className="whitespace-nowrap">
                                <TicketLink status={status} ticket={k} className="font-medium" />
                                {i < g.keys.length - 1 ? "," : ""}
                              </span>
                            ))}
                          </span>
                        </li>
                      ))}
                      {plan.worked.length > 0 && (
                        <li className="flex gap-3">
                          <span className="w-[118px] shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                            Worked on
                          </span>
                          <span className="flex min-w-0 flex-wrap gap-x-1.5 leading-relaxed text-standup">
                            {plan.worked.map((k, i) => (
                              <span key={k} className="whitespace-nowrap">
                                <TicketLink status={status} ticket={k} className="font-medium" />
                                {i < plan.worked.length - 1 ? "," : ""}
                              </span>
                            ))}
                          </span>
                        </li>
                      )}
                    </ul>
                  ) : (
                    <p className="text-standup">Nothing recorded.</p>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Today
                  </h3>
                  {plan.today.length ? (
                    <ul className="flex flex-col gap-2">
                      {plan.today.map((t) => (
                        <li key={t.key} className="flex gap-3">
                          <TicketLink
                            status={status}
                            ticket={t.key}
                            className="shrink-0 whitespace-nowrap font-medium"
                          />
                          <span className="min-w-0 truncate text-standup">{t.summary}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-standup">Pick up the board.</p>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Blockers
                  </h3>
                  <p className="text-standup">None</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">…</p>
            )}
          </div>
        </section>

        <section data-reveal className="min-w-0 flex-[1_1_320px]">
          <h2 className="mb-[18px] font-serif text-2xl font-medium">Your board</h2>
          <ul className="flex flex-col">
            {data?.settings.boardStatuses.map((s, i, arr) => (
              <li key={s}>
                <Link
                  href="/tickets"
                  className={`flex items-baseline justify-between py-[11px] ${
                    i < arr.length - 1 ? "border-b border-[#e6dac0]" : ""
                  }`}
                >
                  <span className="text-sm text-muted">{s}</span>
                  <span className="font-serif text-[22px]">{data.byStatus[s] || 0}</span>
                </Link>
              </li>
            ))}
          </ul>
          {data && (
            <p className="mt-4 text-[13px] text-muted">
              {data.stale.length
                ? `${data.stale.length} ticket${data.stale.length === 1 ? "" : "s"} going stale — `
                : "Nothing is sitting still — "}
              <Link href="/tickets" className="font-medium text-deep">
                {data.stale.length ? "review them" : "see all tickets"}
              </Link>
            </p>
          )}
        </section>
      </div>
    </Reveal>
  );
}
