"use client";

import { useEffect, useState } from "react";
import Reveal from "@/components/Reveal";
import { useStatus } from "@/components/useData";
import type { AppSettings } from "@/lib/types";

export default function SettingsPage() {
  const status = useStatus();
  const [s, setS] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load settings");
        setS(j as AppSettings);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const save = async () => {
    if (!s) return;
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  };

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) =>
    setS((prev) => (prev ? { ...prev, [k]: v } : prev));

  return (
    <Reveal className="max-w-2xl">
      <h1 data-reveal className="font-serif text-4xl font-semibold tracking-tight">
        Settings
      </h1>
      <p data-reveal className="mt-2 text-soft">
        Every team’s Jira is different. Point Devfolio at your fields and statuses.
      </p>

      <section data-reveal className="card mt-8 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Connection</h2>
        <ul className="mt-3 space-y-1 text-sm text-soft">
          <li>
            Jira env vars:{" "}
            {status
              ? status.env.jiraBaseUrl && status.env.jiraEmail && status.env.jiraApiToken
                ? "configured ✓"
                : "missing — set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN in .env.local"
              : "…"}
          </li>
          <li>MongoDB: {status ? (status.mongoOk ? "connected ✓" : "not reachable") : "…"}</li>
          {status?.sync?.displayName && <li>Signed in as {status.sync.displayName}</li>}
        </ul>
        <p className="mt-3 text-xs text-faint">
          Credentials live only in .env.local on your machine; this screen never shows or stores
          them.
        </p>
      </section>

      {error && (
        <p data-reveal className="mt-5 text-sm text-warn">
          {error} — settings need MongoDB. Finish setup first.
        </p>
      )}

      {s && (
        <>
          <section data-reveal className="card mt-5 space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">You</h2>
            <Field label="First name for the morning greeting">
              <input value={s.userName} placeholder="e.g. Muhammad" onChange={(e) => set("userName", e.target.value)} />
            </Field>
            <Field label="Week starts on">
              <select
                value={s.weekStartsMonday ? "mon" : "sun"}
                onChange={(e) => set("weekStartsMonday", e.target.value === "mon")}
              >
                <option value="mon">Monday</option>
                <option value="sun">Sunday</option>
              </select>
            </Field>
            <Field label="Flag tickets as stale after (days in same status)">
              <input
                type="number"
                min={1}
                value={s.staleAfterDays}
                onChange={(e) => set("staleAfterDays", Number(e.target.value) || 3)}
              />
            </Field>
          </section>

          <section data-reveal className="card mt-5 space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Metric signals</h2>
            <p className="text-xs text-faint">
              “Pregroomed” = the first time you set the analysis field on a ticket. “Sent to
              testing” = the first time you set the resolution field. Both are read from the
              ticket changelog, so they count who actually did the work.
            </p>
            <Field label="Analysis field id (pregroomed)">
              <input value={s.analysisFieldId} onChange={(e) => set("analysisFieldId", e.target.value)} />
            </Field>
            <Field label="Resolution field id (sent to testing)">
              <input value={s.resolutionFieldId} onChange={(e) => set("resolutionFieldId", e.target.value)} />
            </Field>
            <Field label="“Analysis by” user field id (used to find your tickets)">
              <input value={s.analysisByFieldId} onChange={(e) => set("analysisByFieldId", e.target.value)} />
            </Field>
            <Field label="“Resolution by” user field id (used to find your tickets)">
              <input value={s.resolutionByFieldId} onChange={(e) => set("resolutionByFieldId", e.target.value)} />
            </Field>
            <Field label="Story points field id">
              <input value={s.storyPointsFieldId} onChange={(e) => set("storyPointsFieldId", e.target.value)} />
            </Field>
            <Field label="QA bounce = a move from this status…">
              <input value={s.testingStatus} onChange={(e) => set("testingStatus", e.target.value)} />
            </Field>
            <Field label="…back to this status">
              <input value={s.reworkStatus} onChange={(e) => set("reworkStatus", e.target.value)} />
            </Field>
          </section>

          <section data-reveal className="card mt-5 space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Board</h2>
            <Field label="Status buckets on My Tickets (one per line, in order)">
              <textarea
                rows={6}
                value={s.boardStatuses.join("\n")}
                onChange={(e) =>
                  set(
                    "boardStatuses",
                    e.target.value
                      .split("\n")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  )
                }
              />
            </Field>
          </section>

          <div data-reveal className="mt-6 flex items-center gap-3">
            <button className="btn" onClick={save}>
              {saved ? "Saved ✓" : "Save settings"}
            </button>
            <span className="text-xs text-faint">
              After changing field ids, run “Sync now” to rescan.
            </span>
          </div>
        </>
      )}
    </Reveal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-soft">{label}</span>
      <span className="flex flex-col">{children}</span>
    </label>
  );
}
