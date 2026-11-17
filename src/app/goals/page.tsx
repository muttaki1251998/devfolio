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

  const isAuto = (g: Goal) => !!(g.metric && g.target);
  const auto = data?.goals.filter(isAuto) ?? [];
  const manual = data?.goals.filter((g) => !isAuto(g)) ?? [];

  return (
    <Reveal className="max-w-[860px]">
      <div data-reveal className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <h1 className="font-serif text-[44px] font-normal leading-tight tracking-[-0.02em]">Goals</h1>
        <p className="text-sm text-muted">
          Check things off yourself, or tie a goal to a metric and let it fill in on its own.
        </p>
      </div>

      {auto.length > 0 && (
        <section data-reveal className="mt-12">
          <h2 className="eyebrow mb-2">Tracked from your work</h2>
          <ul>
            {auto.map((g, i) => {
              const progress = g.progress ?? 0;
              const pct = Math.min(100, Math.round((100 * progress) / g.target!));
              const reached = progress >= g.target!;
              return (
                <li
                  key={g._id}
                  className={`py-6 ${i < auto.length - 1 ? "border-b border-divider" : ""}`}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-base font-medium">{g.title}</span>
                    <span className="flex shrink-0 items-baseline gap-4 text-sm text-muted">
                      <span>
                        <strong className={`font-semibold ${reached ? "text-good" : "text-ink"}`}>
                          {progress}
                        </strong>{" "}
                        of {g.target} this {g.period}
                      </span>
                      <button className="text-xs text-muted hover:text-deep" onClick={() => remove(g)}>
                        Remove
                      </button>
                    </span>
                  </div>
                  <div className="mt-3.5 h-1 rounded-full bg-hairline">
                    <div
                      className="h-1 rounded-full transition-all"
                      style={{ width: `${pct}%`, background: reached ? "var(--good)" : "var(--accent)" }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section data-reveal className="mt-14">
        <h2 className="eyebrow mb-2">Your list</h2>
        <ul>
          {manual.map((g) => (
            <li key={g._id} className="flex items-center gap-[18px] border-b border-divider py-[18px]">
              <input
                type="checkbox"
                id={`goal-${g._id}`}
                checked={g.done}
                onChange={() => toggle(g)}
                className="h-[22px] w-[22px] shrink-0 cursor-pointer accent-accent"
              />
              <label
                htmlFor={`goal-${g._id}`}
                className={`min-w-0 flex-1 cursor-pointer text-base ${
                  g.done ? "text-muted line-through" : ""
                }`}
              >
                {g.title}
              </label>
              <button className="shrink-0 text-xs text-muted hover:text-deep" onClick={() => remove(g)}>
                Remove
              </button>
            </li>
          ))}
          {data && !manual.length && (
            <li className="border-b border-divider py-[18px] text-sm text-muted">
              Nothing on your list yet.
            </li>
          )}
        </ul>

        <form
          className="mt-5 flex flex-wrap items-center gap-x-3.5 gap-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label htmlFor="newgoal" className="sr-only">
            New goal
          </label>
          <input
            id="newgoal"
            type="text"
            className="line-input min-w-0 flex-[1_1_260px] !text-[15px] !py-2.5"
            placeholder="Add a goal…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            aria-label="Goal type"
            className="line-input"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            <option value="">Manual</option>
            <option value="pregroomed">Auto · pregroomed</option>
            <option value="sent_to_testing">Auto · sent to testing</option>
          </select>
          {metric && (
            <>
              <input
                aria-label="Target"
                className="line-input w-16 text-center"
                type="number"
                min={1}
                placeholder="10"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
              <select
                aria-label="Period"
                className="line-input"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option value="week">per week</option>
                <option value="month">per month</option>
              </select>
            </>
          )}
          <button
            type="submit"
            className="btn-pill !px-5 !py-2.5 !text-[13px]"
          >
            Add
          </button>
        </form>
      </section>
    </Reveal>
  );
}
