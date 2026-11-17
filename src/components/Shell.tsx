"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "Home", icon: "☀" },
  { href: "/tickets", label: "My Tickets", icon: "▤" },
  { href: "/dashboard", label: "Dashboard", icon: "◔" },
  { href: "/goals", label: "Goals", icon: "✓" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

interface Status {
  configured: boolean;
  mongoOk: boolean;
  env: Record<string, boolean>;
  sync: { lastSyncAt?: string | null; displayName?: string | null } | null;
}

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

  const last = status?.sync?.lastSyncAt ? new Date(status.sync.lastSyncAt) : null;

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-raised/60 px-4 py-6">
        <Link href="/" className="mb-8 flex items-center gap-2 px-2">
          <SunMark />
          <span className="font-serif text-2xl font-semibold tracking-tight">devfolio</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-wash font-semibold text-accent-deep"
                    : "text-soft hover:bg-sunken hover:text-ink"
                }`}
              >
                <span className="w-4 text-center">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2 px-2 pt-6 text-xs text-faint">
          {status && !status.configured && (
            <p className="text-warn">Setup needed — see Settings.</p>
          )}
          {last && <p>Synced {last.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>}
          <button className="btn-ghost btn !px-2 !py-1 text-xs" onClick={() => sync()} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-8 lg:px-12">{children}</main>
    </div>
  );
}

function SunMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
      <circle cx="13" cy="15" r="6" fill="var(--accent)" />
      <g stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
        <line x1="13" y1="3" x2="13" y2="6" />
        <line x1="4" y1="7" x2="6.2" y2="9.2" />
        <line x1="22" y1="7" x2="19.8" y2="9.2" />
      </g>
      <rect x="1" y="19.5" width="24" height="2.4" rx="1.2" fill="var(--ink)" opacity="0.85" />
    </svg>
  );
}
