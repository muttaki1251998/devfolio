"use client";

import { useState } from "react";
import Reveal from "@/components/Reveal";
import SetupCard from "@/components/SetupCard";
import TicketLink from "@/components/TicketLink";
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

const COLLAPSED_ROWS = 6;

export default function TicketsPage() {
  const status = useStatus();
  const { data } = useJson<TicketsPayload>(status?.configured ? "/api/tickets" : null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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

  const isStale = (r: TicketRow) =>
    !!data && r.daysInStatus !== null && r.daysInStatus >= data.staleAfterDays;
  const staleCount = data ? data.rows.filter(isStale).length : 0;

  return (
    <Reveal className="max-w-[1000px]">
      <div data-reveal className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <h1 className="font-serif text-[44px] font-normal leading-tight tracking-[-0.02em]">My Tickets</h1>
        <p className="text-sm text-muted">
          {data ? (
            <>
              {data.rows.length} open
              {staleCount > 0 && (
                <>
                  {" · "}
                  <span className="font-medium text-bounce">
                    {staleCount} idle {data.staleAfterDays}+ days
                  </span>
                </>
              )}
            </>
          ) : (
            "Loading…"
          )}
        </p>
      </div>

      {groups.map((g) => {
        const open = !!expanded[g.status];
        const hidden = g.rows.length - COLLAPSED_ROWS;
        const shown = open || hidden <= 0 ? g.rows : g.rows.slice(0, COLLAPSED_ROWS);
        return (
          <section key={g.status} data-reveal className="mt-12">
            <div className="flex items-baseline gap-3.5 border-b border-rule pb-2.5">
              <h2 className="font-serif text-[22px] font-medium">{g.status}</h2>
              <span className="text-sm text-muted">{g.rows.length}</span>
            </div>
            <ul>
              {shown.map((r, i) => {
                const stale = isStale(r);
                return (
                  <li
                    key={r.key}
                    className={`flex items-baseline gap-4 py-[15px] ${
                      i < shown.length - 1 ? "border-b border-divider" : ""
                    }`}
                  >
                    <TicketLink status={status} ticket={r.key} className="w-[88px] shrink-0 whitespace-nowrap text-sm font-semibold" />
                    <span className="min-w-0 truncate text-sm text-standup">{r.summary}</span>
                    <span className="ml-auto shrink-0 text-[13px] text-muted">
                      {r.storyPoints != null ? `${r.storyPoints} ${r.storyPoints === 1 ? "pt" : "pts"}` : ""}
                    </span>
                    <span
                      className={`w-[90px] shrink-0 text-right text-[13px] ${
                        stale ? "font-medium text-bounce" : "text-muted"
                      }`}
                    >
                      {r.daysInStatus !== null ? `${stale ? "● " : ""}${r.daysInStatus}d here` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
            {hidden > 0 && (
              <button
                className="btn-link mt-3"
                onClick={() => setExpanded((p) => ({ ...p, [g.status]: !open }))}
              >
                {open ? "Show fewer" : `Show ${hidden} more`}
              </button>
            )}
          </section>
        );
      })}
      {data && !data.rows.length && (
        <p data-reveal className="mt-12 text-muted">
          Nothing assigned to you right now. Run a sync from the sidebar if that seems wrong.
        </p>
      )}
    </Reveal>
  );
}
