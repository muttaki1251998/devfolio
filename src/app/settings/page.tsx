"use client";

import { useEffect, useState } from "react";
import Reveal from "@/components/Reveal";
import { useStatus } from "@/components/useData";
import type { AppSettings } from "@/lib/types";

export default function SettingsPage() {
  const status = useStatus();
  const [s, setS] = useState<AppSettings | null>(null);
  const [boardText, setBoardText] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load settings");
        setS(j as AppSettings);
        setBoardText((j as AppSettings).boardStatuses.join(", "));
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
    if (res.ok) setSavedAt(new Date());
  };

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) =>
    setS((prev) => (prev ? { ...prev, [k]: v } : prev));

  const jiraOk = status
    ? (status.env.jiraBaseUrl && status.env.jiraEmail && status.env.jiraApiToken) || !!status.auth?.enabled
    : null;

  return (
    <Reveal className="max-w-[860px]">
      <h1 data-reveal className="font-serif text-[44px] font-normal leading-tight tracking-[-0.02em]">
        Settings
      </h1>
      <p data-reveal className="mt-3 max-w-[560px] text-sm text-muted">
        Field ids and statuses that tell Devfolio what to count. Every team’s Jira is different, so
        point these at yours.
      </p>

      {error && (
        <p data-reveal className="mt-8 text-sm text-deep">
          {error} — settings need MongoDB. Finish setup first.
        </p>
      )}

      {s && (
        <>
          <Group title="Jira signals">
            <Row
              label="Pregroomed field"
              help="First time you set this field counts as a pregroom"
              last={false}
            >
              <input
                className="line-input w-[220px]"
                value={s.analysisFieldId}
                onChange={(e) => set("analysisFieldId", e.target.value)}
              />
            </Row>
            <Row
              label="Sent-to-testing field"
              help="First time you set Resolution Details counts as a handoff"
            >
              <input
                className="line-input w-[220px]"
                value={s.resolutionFieldId}
                onChange={(e) => set("resolutionFieldId", e.target.value)}
              />
            </Row>
            <Row label="Analysis by field" help="User field used to find your pregroomed tickets">
              <input
                className="line-input w-[220px]"
                value={s.analysisByFieldId}
                onChange={(e) => set("analysisByFieldId", e.target.value)}
              />
            </Row>
            <Row label="Resolution by field" help="User field used to find your handed-off tickets">
              <input
                className="line-input w-[220px]"
                value={s.resolutionByFieldId}
                onChange={(e) => set("resolutionByFieldId", e.target.value)}
              />
            </Row>
            <Row
              label="QA bounce transition"
              help="A status move that counts against clean handoffs"
            >
              <span className="flex items-center gap-2.5">
                <input
                  aria-label="From status"
                  className="line-input w-[120px]"
                  value={s.testingStatus}
                  onChange={(e) => set("testingStatus", e.target.value)}
                />
                <span aria-hidden className="text-muted">
                  →
                </span>
                <input
                  aria-label="To status"
                  className="line-input w-[120px]"
                  value={s.reworkStatus}
                  onChange={(e) => set("reworkStatus", e.target.value)}
                />
              </span>
            </Row>
            <Row label="Story points field" last>
              <input
                className="line-input w-[220px]"
                value={s.storyPointsFieldId}
                onChange={(e) => set("storyPointsFieldId", e.target.value)}
              />
            </Row>
          </Group>

          <Group title="Board">
            <Row
              label="Statuses shown on Home and My Tickets"
              help="Comma-separated, in display order"
              last
            >
              <input
                className="line-input min-w-0 flex-[1_1_320px]"
                value={boardText}
                onChange={(e) => {
                  setBoardText(e.target.value);
                  set(
                    "boardStatuses",
                    e.target.value
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  );
                }}
              />
            </Row>
          </Group>

          <Group title="Preferences">
            <Row label="Your name" help="Used in the morning greeting">
              <input
                className="line-input w-[220px]"
                placeholder="e.g. Muhammad"
                value={s.userName}
                onChange={(e) => set("userName", e.target.value)}
              />
            </Row>
            <Row label="Week starts on">
              <select
                className="line-input w-[220px]"
                value={s.weekStartsMonday ? "mon" : "sun"}
                onChange={(e) => set("weekStartsMonday", e.target.value === "mon")}
              >
                <option value="mon">Monday</option>
                <option value="sun">Sunday</option>
              </select>
            </Row>
            <Row label="Mark a ticket stale after" last>
              <span className="flex items-baseline gap-2.5">
                <input
                  type="number"
                  min={1}
                  className="line-input w-[60px] text-center"
                  value={s.staleAfterDays}
                  onChange={(e) => set("staleAfterDays", Number(e.target.value) || 3)}
                />
                <span className="text-sm text-muted">days without moving</span>
              </span>
            </Row>
          </Group>

          <div data-reveal className="mt-12 flex items-center gap-5">
            <button className="btn-pill" onClick={save}>
              Save changes
            </button>
            <span className="text-[13px] text-muted">
              {savedAt
                ? `Saved at ${savedAt
                    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                    .toLowerCase()}`
                : "After changing field ids, run Sync now to rescan."}
            </span>
          </div>
        </>
      )}

      <Group title="Connection">
        <Row label="Jira credentials" help="Set in .env.local; never shown or stored here">
          <span className="text-sm text-muted">
            {jiraOk === null ? "…" : jiraOk ? "Configured" : "Missing — see Home"}
          </span>
        </Row>
        <Row label="MongoDB">
          <span className="text-sm text-muted">
            {status ? (status.mongoOk ? "Connected" : "Not reachable") : "…"}
          </span>
        </Row>
        <Row label="Signed in to Jira as" last>
          <span className="text-sm text-muted">{status?.sync?.displayName || "—"}</span>
        </Row>
      </Group>
    </Reveal>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section data-reveal className="mt-12">
      <h2 className="eyebrow mb-1.5">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function Row({
  label,
  help,
  last,
  children,
}: {
  label: string;
  help?: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`flex flex-wrap items-center gap-x-6 gap-y-2 py-5 ${
        last ? "" : "border-b border-divider"
      }`}
    >
      <span className="min-w-0 flex-[1_1_300px]">
        <span className="block text-[15px] font-medium">{label}</span>
        {help && <span className="mt-[3px] block text-[13px] text-muted">{help}</span>}
      </span>
      {children}
    </label>
  );
}
