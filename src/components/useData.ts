"use client";

import { useCallback, useEffect, useState } from "react";

export interface AppStatus {
  configured: boolean;
  mongoOk: boolean;
  env: Record<string, boolean>;
  sync: { lastSyncAt?: string | null; displayName?: string | null } | null;
  jiraBaseUrl?: string | null;
}

/** Browse URL for a ticket on the configured Jira site, or null while status loads. */
export function ticketUrl(status: AppStatus | null, key: string): string | null {
  return status?.jiraBaseUrl ? `${status.jiraBaseUrl}/browse/${key}` : null;
}

/** Fetches JSON and refetches whenever a sync completes. */
export function useJson<T>(url: string | null): { data: T | null; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!url) return;
    fetch(url)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        setData(j as T);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [url]);

  useEffect(() => {
    reload();
    const onSync = () => reload();
    window.addEventListener("devfolio:synced", onSync);
    return () => window.removeEventListener("devfolio:synced", onSync);
  }, [reload]);

  return { data, error, reload };
}

export function useStatus(): AppStatus | null {
  const { data } = useJson<AppStatus>("/api/status");
  return data;
}
