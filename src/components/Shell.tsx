"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useJson } from "@/components/useData";
import type { MetricCounts } from "@/lib/types";

interface Status {
  configured: boolean;
  mongoOk: boolean;
  env: Record<string, boolean>;
  sync: { lastSyncAt?: string | null; displayName?: string | null } | null;
}

interface SummaryLite {
  settings: { userName: string };
  totalMine: number;
}

interface GoalLite {
  done: boolean;
  metric: string | null;
  target: number | null;
  progress: number | null;
}

const NAV = [
  { href: "/", label: "Home" },
  { href: "/tickets", label: "My Tickets" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/goals", label: "Goals" },
  { href: "/settings", label: "Settings" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status | null>(null);
  const [syncing, setSyncing] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      setStatus(await res.json());
    } catch {
      /* server not up yet */
    }
  }, []);

  const sync = useCallback(
    async (ifStale?: boolean) => {
      setSyncing(true);
      try {
        await fetch(`/api/sync${ifStale ? "?ifStale=15" : ""}`, { method: "POST" });
        await refreshStatus();
        window.dispatchEvent(new CustomEvent("devfolio:synced"));
      } finally {
        setSyncing(false);
      }
    },
    [refreshStatus],
  );

  useEffect(() => {
    refreshStatus().then(() => {});
  }, [refreshStatus]);

  // Once we know the app is configured, keep data fresh in the background.
  useEffect(() => {
    if (status?.configured) {
      sync(true);
      const t = setInterval(() => sync(true), 15 * 60_000);
      return () => clearInterval(t);
    }
  }, [status?.configured, sync]);

  const configured = !!status?.configured;
  const { data: summary } = useJson<SummaryLite>(configured ? "/api/summary" : null);
  const { data: goalsData } = useJson<{ goals: GoalLite[] }>(configured ? "/api/goals" : null);
  const { data: week } = useJson<{ counts: MetricCounts }>(configured ? "/api/metrics?period=week" : null);

  const last = status?.sync?.lastSyncAt ? new Date(status.sync.lastSyncAt) : null;
  const lastLabel = last
    ? last.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase()
    : null;

  const openGoals = goalsData
    ? goalsData.goals.filter((g) =>
        g.metric && g.target ? (g.progress ?? 0) < g.target : !g.done,
      ).length
    : null;

  const counts = week?.counts;
  const cleanRate =
    counts && counts.sentToTesting > 0
      ? Math.round((100 * Math.max(counts.sentToTesting - counts.qaBounces, 0)) / counts.sentToTesting)
      : null;

  const userName =
    summary?.settings.userName || status?.sync?.displayName?.split(" ")[0] || "";
  const initial = userName ? userName.charAt(0).toUpperCase() : "·";

  const badge = (href: string): string | null => {
    if (href === "/tickets" && summary) return String(summary.totalMine);
    if (href === "/goals" && openGoals !== null) return `${openGoals} open`;
    return null;
  };

  return (
    <div className="shell">
      <aside className="rail">
        <Link
          href="/"
          className="font-serif text-2xl font-semibold italic tracking-[-0.02em]"
        >
          devfolio
        </Link>

        <nav aria-label="Main" className="mt-10 flex flex-col gap-0.5">
          {NAV.map((n) => {
            const active = pathname === n.href;
            const b = badge(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 py-2.5 text-[15px] ${
                  active
                    ? "border-l-[3px] border-accent bg-navactive pl-[11px] pr-3.5 font-semibold text-ink"
                    : "px-3.5 font-medium text-muted hover:text-deep"
                }`}
              >
                {n.label}
                {b && <span className="ml-auto text-[13px] font-normal text-muted">{b}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-10 border-t border-siderule pt-[22px]">
          <h2 className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            This week
          </h2>
          <div className="flex flex-col gap-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Pregroomed</span>
              <strong className="font-semibold">{counts ? counts.pregroomed : "–"}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Sent to test</span>
              <strong className="font-semibold">{counts ? counts.sentToTesting : "–"}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Clean rate</span>
              <strong className="font-semibold text-deep">
                {cleanRate !== null ? `${cleanRate}%` : "–"}
              </strong>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-10">
          <div className="flex flex-col gap-3.5 border-t border-siderule pt-[22px]">
            {status && !status.configured && (
              <p className="text-[13px] text-deep">Setup needed — see Home.</p>
            )}
            <span className="flex items-center gap-[9px] text-[13px] text-muted">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: last ? "var(--good)" : "var(--rule)" }}
              />
              {syncing ? "Syncing…" : lastLabel ? `Synced ${lastLabel}` : "Not synced yet"}
            </span>
            <button
              className="btn-outline self-start"
              onClick={() => sync()}
              disabled={syncing}
            >
              {syncing ? "Syncing…" : "Sync now"}
            </button>
            <div className="flex items-center gap-2.5 border-t border-siderule pt-4">
              <span
                aria-hidden
                className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-[#fff7ec]"
              >
                {initial}
              </span>
              <span className="min-w-0 truncate text-sm font-medium">{userName || "You"}</span>
              <button type="button" className="btn-link ml-auto">
                Log out
              </button>
            </div>
          </div>
        </div>
      </aside>
      <main className="main-area">{children}</main>
    </div>
  );
}
