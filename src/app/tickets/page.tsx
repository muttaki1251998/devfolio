"use client";

import Reveal from "@/components/Reveal";
import SetupCard from "@/components/SetupCard";
import { useJson, useStatus } from "@/components/useData";

interface TicketRow {
  key: string;
  summary: string;
  status: string;
  issueType: string;
  priority: string | null;
  storyPoints: number | null;
  updatedAt: string;
  daysInStatus: number | null;
}

interface TicketsPayload {
  rows: TicketRow[];
  boardStatuses: string[];
  staleAfterDays: number;
}

export default function TicketsPage() {
  const status = useStatus();
  const { data } = useJson<TicketsPayload>(status?.configured ? "/api/tickets" : null);

  if (status && !status.configured) {
    return <SetupCard env={status.env} mongoOk={status.mongoOk} />;
  }

  const groups = data
    ? [
        ...data.boardStatuses.map((s) => ({
          status: s,
          rows: data.rows.filter((r) => r.status === s),
        })),
        {
          status: "Elsewhere",
          rows: data.rows.filter((r) => !data.boardStatuses.includes(r.status)),
        },
      ].filter((g) => g.rows.length)
    : [];

  return (
    <Reveal className="max-w-4xl">
      <h1 data-reveal className="font-serif text-4xl font-semibold tracking-tight">
        My Tickets
      </h1>
      <p data-reveal className="mt-2 text-soft">
        {data ? `${data.rows.length} open tickets assigned to you.` : "Loading…"}
      </p>

      <div className="mt-8 space-y-8">
        {groups.map((g) => (
          <section key={g.status} data-reveal>
            <div className="mb-3 flex items-baseline gap-3">
              <h2 className="font-serif text-xl font-semibold">{g.status}</h2>
              <span className="text-sm text-faint">{g.rows.length}</span>
            </div>
            <div className="card divide-y divide-line">
              {g.rows.map((r) => {
                const stale = data && r.daysInStatus !== null && r.daysInStatus >= data.staleAfterDays;
                return (
                  <div key={r.key} className="flex items-center gap-4 px-5 py-3.5">
                    <span className="w-24 shrink-0 text-sm font-semibold">{r.key}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-soft">{r.summary}</span>
                    {r.storyPoints != null && <span className="chip shrink-0">{r.storyPoints} pts</span>}
                    {r.daysInStatus !== null && (
                      <span className={`chip shrink-0 ${stale ? "!bg-wash !text-accent-deep" : ""}`}>
                        {r.daysInStatus}d
                      </span>
                    )}
                    <span className="w-16 shrink-0 text-right text-xs text-faint">{r.issueType}</span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {data && !data.rows.length && (
          <p data-reveal className="text-soft">
            Nothing assigned to you right now. Run a sync from the sidebar if that seems wrong.
          </p>
        )}
      </div>
    </Reveal>
  );
}
