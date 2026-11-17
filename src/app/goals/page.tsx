"use client";

import { useState } from "react";
import Reveal from "@/components/Reveal";
import SetupCard from "@/components/SetupCard";
import { useJson, useStatus } from "@/components/useData";
import type { MetricEventType } from "@/lib/types";

interface Goal {
  _id: string;
  title: string;
  done: boolean;
  metric: MetricEventType | null;
  target: number | null;
  period: "week" | "month" | null;
  progress: number | null;
}

export default function GoalsPage() {
  const status = useStatus();
  const { data, reload } = useJson<{ goals: Goal[] }>(status?.configured ? "/api/goals" : null);
  const [title, setTitle] = useState("");
  const [metric, setMetric] = useState<string>("");
  const [target, setTarget] = useState<string>("");
  const [period, setPeriod] = useState<string>("week");

  if (status && !status.configured) {
    return <SetupCard env={status.env} mongoOk={status.mongoOk} />;
  }

  const add = async () => {
    if (!title.trim()) return;
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        metric: metric || null,
        target: metric && target ? Number(target) : null,
        period: metric ? period : null,
      }),
    });
    setTitle("");
    setMetric("");
    setTarget("");
    reload();
  };

  const toggle = async (g: Goal) => {
    await fetch(`/api/goals/${g._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !g.done }),
    });
    reload();
  };

  const remove = async (g: Goal) => {
    await fetch(`/api/goals/${g._id}`, { method: "DELETE" });
    reload();
  };

  return (
    <Reveal className="max-w-3xl">
      <h1 data-reveal className="font-serif text-4xl font-semibold tracking-tight">
        Goals
      </h1>
      <p data-reveal className="mt-2 text-soft">
        Check things off yourself, or tie a goal to a metric and let it fill in on its own.
      </p>

      <div data-reveal className="card mt-8 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="min-w-0 flex-1"
            placeholder="e.g. Pregroom 10 tickets this week"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            <option value="">Manual</option>
            <option value="pregroomed">Auto · pregroomed</option>
            <option value="sent_to_testing">Auto · sent to testing</option>
          </select>
          {metric && (
            <>
              <input
                className="w-20"
                type="number"
                min={1}
                placeholder="10"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
              <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="week">per week</option>
                <option value="month">per month</option>
              </select>
            </>
          )}
          <button className="btn" onClick={add}>
            Add
          </button>
        </div>
      </div>

      <ul className="mt-6 space-y-3">
        {data?.goals.map((g) => {
          const auto = g.metric && g.target;
          const pct = auto ? Math.min(100, Math.round((100 * (g.progress ?? 0)) / g.target!)) : null;
          const reached = auto ? (g.progress ?? 0) >= g.target! : g.done;
          return (
            <li key={g._id} data-reveal className="card flex items-center gap-4 px-5 py-4">
              <button
                onClick={() => !auto && toggle(g)}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs transition-colors ${
                  reached
                    ? "border-accent bg-accent text-white"
                    : "border-line bg-raised text-transparent hover:border-accent"
                } ${auto ? "cursor-default" : "cursor-pointer"}`}
                title={auto ? "Fills in automatically" : "Toggle"}
              >
                ✓
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${reached ? "text-faint line-through" : ""}`}>{g.title}</p>
                {auto && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="shrink-0 text-xs text-faint">
                      {g.progress ?? 0}/{g.target} this {g.period}
                    </span>
                  </div>
                )}
              </div>
              <button className="shrink-0 text-xs text-faint hover:text-accent-deep" onClick={() => remove(g)}>
                remove
              </button>
            </li>
          );
        })}
        {data && !data.goals.length && (
          <li data-reveal className="text-sm text-faint">
            No goals yet. Set one above — “Pregroom 10 tickets this week” is a classic.
          </li>
        )}
      </ul>
    </Reveal>
  );
}
