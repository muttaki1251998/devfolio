"use client";

import { useEffect, useMemo, useState } from "react";
import Reveal from "@/components/Reveal";
import SetupCard from "@/components/SetupCard";
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
  sent_to_testing: "Sent to testing",
  qa_bounce: "Bounced back from QA",
};

function greeting(name: string, now: Date): string {
  const h = now.getHours();
  const part = h < 5 ? "Up early" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}.` : `${part}.`;
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

  const standup = useMemo(() => {
    if (!data) return "";
    const y: string[] = [];
    for (const e of data.recentEvents) {
      y.push(`- ${EVENT_LABEL[e.type]}: ${e.ticketKey}${e.summary ? ` — ${e.summary}` : ""}`);
    }
    for (const t of data.touched) {
      if (!data.recentEvents.some((e) => e.ticketKey === t.key)) {
        y.push(`- Worked on ${t.key} — ${t.summary} (${t.status})`);
      }
    }
    const today = data.touched
      .slice(0, 5)
      .map((t) => `- Continue ${t.key} — ${t.summary} (${t.status})`);
    return [
      "Yesterday:",
      ...(y.length ? y : ["- (nothing recorded)"]),
      "",
      "Today:",
      ...(today.length ? today : ["- Pick up the board"]),
      "",
      "Blockers:",
      "- None",
    ].join("\n");
  }, [data]);

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
    : " ";

  return (
    <Reveal className="max-w-5xl">
      <p data-reveal className="text-sm text-faint">
        {dateStr}
      </p>
      <h1 data-reveal className="mt-1 font-serif text-5xl font-semibold tracking-tight">
        {now ? greeting(name, now) : " "}
      </h1>
      <p data-reveal className="mt-3 text-soft">
        {data
          ? `${data.totalMine} tickets on your plate. Here’s what moved since yesterday.`
          : "Warming up…"}
      </p>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <section data-reveal className="card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">
            Since yesterday
          </h2>
          <ul className="mt-4 space-y-3">
            {data?.recentEvents.map((e) => (
              <li key={`${e.ticketKey}-${e.type}-${e.at}`} className="flex items-start gap-3 text-sm">
                <span
                  className={`chip shrink-0 ${e.type === "qa_bounce" ? "!bg-wash !text-accent-deep" : ""}`}
                >
                  {EVENT_LABEL[e.type]}
                </span>
                <span>
                  <span className="font-semibold">{e.ticketKey}</span>{" "}
                  <span className="text-soft">{e.summary}</span>
                </span>
              </li>
            ))}
            {data?.touched
              .filter((t) => !data.recentEvents.some((e) => e.ticketKey === t.key))
              .slice(0, 6)
              .map((t) => (
                <li key={t.key} className="flex items-start gap-3 text-sm">
                  <span className="chip shrink-0">Moved</span>
                  <span>
                    <span className="font-semibold">{t.key}</span>{" "}
                    <span className="text-soft">{t.summary}</span>{" "}
                    <span className="text-faint">· {t.status}</span>
                  </span>
                </li>
              ))}
            {data && !data.recentEvents.length && !data.touched.length && (
              <li className="text-sm text-faint">A quiet day. Nothing changed since yesterday.</li>
            )}
          </ul>
        </section>

        <section data-reveal className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">
              Standup, drafted
            </h2>
            <button
              className="btn-ghost btn !py-1 text-xs"
              onClick={() => {
                navigator.clipboard.writeText(standup).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-6 text-soft">
            {standup || "…"}
          </pre>
        </section>

        <section data-reveal className="card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Your board</h2>
          <ul className="mt-4 space-y-2">
            {data?.settings.boardStatuses.map((s) => (
              <li key={s} className="flex items-center justify-between text-sm">
                <span className="text-soft">{s}</span>
                <span className="font-serif text-lg font-semibold">{data.byStatus[s] || 0}</span>
              </li>
            ))}
          </ul>
        </section>

        <section data-reveal className="card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Going stale</h2>
          <ul className="mt-4 space-y-3">
            {data?.stale.slice(0, 6).map((t) => (
              <li key={t.key} className="flex items-start justify-between gap-3 text-sm">
                <span>
                  <span className="font-semibold">{t.key}</span>{" "}
                  <span className="text-soft">{t.summary}</span>
                </span>
                <span className="chip !bg-wash !text-accent-deep shrink-0">
                  {t.days}d in {t.status}
                </span>
              </li>
            ))}
            {data && !data.stale.length && (
              <li className="text-sm text-faint">Nothing is sitting still. Nice.</li>
            )}
          </ul>
        </section>
      </div>
    </Reveal>
  );
}
