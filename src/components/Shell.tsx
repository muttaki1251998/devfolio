"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useJson } from "@/components/useData";
import type { MetricCounts } from "@/lib/types";

interface Status {
  configured: boolean;
  mongoOk: boolean;
  env: Record<string, boolean>;
  sync: { lastSyncAt?: string | null; displayName?: string | null } | null;
  auth?: {
    enabled: boolean;
    signedIn?: boolean;
    user: { name: string | null; email: string | null } | null;
  };
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
  if (pathname === "/login") return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  // The item clicked last, so the highlight moves on click instead of after the page loads.
  // It only counts while we're still on the page it was clicked from.
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  const activeHref = pending && pending.from === pathname ? pending.href : pathname;
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  /** Moves the highlight onto the active item; `animate: false` jumps there. */
  const placeIndicator = useCallback((animate: boolean) => {
    const nav = navRef.current;
    const ind = indicatorRef.current;
    if (!nav || !ind) return;
    const el = nav.querySelector<HTMLElement>("[data-active]");
    if (!el) {
      ind.style.opacity = "0";
      return;
    }
    if (!animate) ind.style.transition = "none";
    ind.style.transform = `translateY(${el.offsetTop}px)`;
    ind.style.height = `${el.offsetHeight}px`;
    ind.style.opacity = "1";
    if (!animate) {
      void ind.offsetHeight; // commit the jump before transitions come back
      ind.style.transition = "";
    }
  }, []);

  // Slide to the active item when it changes; the very first placement jumps.
  const placedOnce = useRef(false);
  useLayoutEffect(() => {
    placeIndicator(placedOnce.current);
    placedOnce.current = true;
  }, [activeHref, placeIndicator]);

  // Late font loads or a resize change item heights; follow without animating. Set up once:
  // a ResizeObserver fires as soon as it observes, which would cancel a slide in progress.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      placeIndicator(false);
    });
    ro.observe(nav);
    return () => ro.disconnect();
  }, [placeIndicator]);
  const [syncing, setSyncing] = useState(false);

  /** Fetches status; sends a signed-out user (e.g. an expired session) to the login page. */
  const fetchStatus = useCallback(async (): Promise<Status | null> => {
    try {
      const res = await fetch("/api/status");
      const s = res.ok ? ((await res.json()) as Status) : null;
      if (res.status === 401 || (s?.auth?.enabled && !s.auth.signedIn)) {
        router.replace("/login");
        return null;
      }
      return s;
    } catch {
      return null; /* server not up yet */
    }
  }, [router]);

  const refreshStatus = useCallback(async () => {
    const s = await fetchStatus();
    if (s) setStatus(s);
  }, [fetchStatus]);

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
    let live = true;
    fetchStatus().then((s) => {
      if (live && s) setStatus(s);
    });
    return () => {
      live = false;
    };
  }, [fetchStatus]);

  // Once we know the app is configured, keep data fresh in the background. The first run
  // is scheduled rather than called inline, so a dev-mode effect re-run cancels it.
  useEffect(() => {
    if (!status?.configured) return;
    const first = setTimeout(() => sync(true), 0);
    const t = setInterval(() => sync(true), 15 * 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
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

  const sessionUser = status?.auth?.enabled ? status.auth.user : null;
  const userName =
    sessionUser?.name?.split(" ")[0] ||
    sessionUser?.email?.split("@")[0] ||
    summary?.settings.userName ||
    status?.sync?.displayName?.split(" ")[0] ||
    "";
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

        <nav ref={navRef} aria-label="Main" className="nav mt-10 flex flex-col gap-0.5">
          <span ref={indicatorRef} aria-hidden className="nav-indicator" />
          {NAV.map((n) => {
            const active = activeHref === n.href;
            const b = badge(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={pathname === n.href ? "page" : undefined}
                data-active={active ? "" : undefined}
                onClick={(e) => {
                  // Modified clicks open a new tab; this page's highlight shouldn't move.
                  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  setPending({ href: n.href, from: pathname });
                }}
                className="nav-link"
              >
                <span className="nav-link-inner">
                  {n.label}
                  {b && <span className="ml-auto text-[13px] font-normal text-muted">{b}</span>}
                </span>
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
              {sessionUser && (
                <button
                  type="button"
                  className="btn-link ml-auto"
                  onClick={() => signOut({ redirectTo: "/login" })}
                >
                  Log out
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
      <main className="main-area">{children}</main>
    </div>
  );
}
