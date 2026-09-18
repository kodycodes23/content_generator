"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import type { PipelineStage } from "@/lib/types";

interface Step {
  label: string;
  activities: string[];
}

const STEPS: Step[] = [
  {
    label: "Researching",
    activities: [
      "Scanning industry publications for related coverage",
      "Cross-referencing candidate sources against the topic",
      "Ranking sources by relevance and recency",
      "Checking for conflicting claims across sources",
    ],
  },
  {
    label: "Extracting citations",
    activities: [
      "Pulling key excerpts from each source",
      "Verifying quotes against their original context",
      "Tagging excerpts by the section they'll support",
      "Discarding excerpts that don't hold up",
    ],
  },
  {
    label: "Drafting",
    activities: [
      "Outlining section structure",
      "Writing the introduction around the primary keyword",
      "Drafting supporting sections with grounded claims",
      "Adding internal and external links",
    ],
  },
  {
    label: "Evaluating",
    activities: [
      "Scoring topic relevance",
      "Checking source grounding on every claim",
      "Auditing tone and audience fit",
      "Checking SEO fit against best practices",
      "Flagging sections that need another pass",
    ],
  },
  {
    label: "Adapting channels",
    activities: [
      "Adapting the piece for LinkedIn (PAS structure)",
      "Breaking the piece down into an X thread",
      "Drafting a newsletter subject line and CTA",
      "Checking each variant against formatting rules",
    ],
  },
];

const TIPS = [
  "The primary keyword should appear in the title and within the first 100 words.",
  "Short paragraphs of 2–3 sentences are easier to skim, especially on mobile.",
  "Every claim should trace back to a reviewed source — that's what the grounding score checks.",
  "LinkedIn posts that end with a genuine question tend to draw more comments.",
  "X posts land best with one core idea and no more than 1–2 hashtags.",
  "Newsletters between 250–600 words respect a busy reader's time.",
  "2–3 relevant links give a piece more credibility without cluttering it.",
];

function activeStepIndex(progress: number): number {
  if (progress < 25) return 0;
  if (progress < 45) return 1;
  if (progress < 70) return 2;
  if (progress < 90) return 3;
  return 4;
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PipelineStatus({ stage, topic }: { stage: PipelineStage; topic: string }) {
  const stepIndex = activeStepIndex(stage.progress);
  const [elapsed, setElapsed] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [activityTick, setActivityTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTipIndex((i) => (i + 1) % TIPS.length), 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setActivityTick((c) => c + 1), 1500);
    return () => clearInterval(timer);
  }, []);

  const stepActivities = STEPS[stepIndex].activities;
  const activity = stepActivities[activityTick % stepActivities.length];

  const remainingEstimate =
    stage.progress > 8 ? Math.max(Math.round((elapsed / stage.progress) * 100 - elapsed), 3) : null;

  return (
    <div className="flex flex-1 items-center justify-center px-8 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900">Working on it</h2>
          <p className="mx-auto mt-1.5 max-w-xs text-xs text-slate-500">&ldquo;{topic}&rdquo;</p>

          <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-700 ease-out"
              style={{ width: `${Math.max(stage.progress, 4)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span className="tabular-nums">{formatClock(elapsed)} elapsed</span>
            <span className="tabular-nums">{remainingEstimate !== null ? `~${remainingEstimate}s left` : ""}</span>
          </div>

          <ol className="mt-6 space-y-2.5 text-left">
            {STEPS.map((step, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex;
              return (
                <li key={step.label}>
                  <div className="flex items-center gap-2 text-xs">
                    {done ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    ) : (
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          active ? "animate-pulse bg-indigo-500" : "bg-slate-200"
                        }`}
                      />
                    )}
                    <span className={done || active ? "font-medium text-slate-700" : "text-slate-400"}>
                      {step.label}
                    </span>
                  </div>
                  {active && (
                    <p
                      key={activity}
                      className="animate-fade-in-up ml-5 mt-1 text-[11px] text-indigo-600/80"
                    >
                      {activity}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <p key={tipIndex} className="animate-fade-in-up text-xs leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-800">Tip: </span>
            {TIPS[tipIndex]}
          </p>
          <div className="mt-3 flex justify-center gap-1.5">
            {TIPS.map((tip, i) => (
              <button
                key={tip}
                type="button"
                aria-label={`Show tip ${i + 1}`}
                onClick={() => setTipIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === tipIndex ? "w-4 bg-indigo-500" : "w-1.5 bg-slate-200 hover:bg-slate-300"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            Browse other requests while this finishes
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function PipelineErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">The last pipeline run failed</p>
        <p className="mt-0.5 text-xs text-red-700">{message}</p>
      </div>
    </div>
  );
}
