"use client";

import { useState } from "react";
import { Check, ChevronDown, History, Tag, X, XCircle } from "lucide-react";
import { ScoreBadge } from "./ArticleReviewPanel";
import { relativeTime } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/role";
import { SUBSCORE_KEYS as SUBSCORE_ORDER, SUBSCORE_LABELS } from "@/lib/rubric";
import { REVISION_TARGET_LABELS } from "@/lib/content-request";
import type { DiffPart, EvaluationReportDetail, ResearchedKeywords, RevisionHistoryEntry } from "@/lib/content-request";

const CHANNEL_FIT_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  twitter_thread: "X / Twitter",
  newsletter: "Newsletter",
  quote_cards: "Quote Cards",
};

const STATUS_LOG_LABELS = {
  submission_status: "Recalled submission",
  approval_status: "Recalled approval",
} as const;

const CHANNEL_FIT_ORDER = ["linkedin", "twitter_thread", "newsletter", "quote_cards"] as const;

function SubscoreTile({ label, score }: { label: string; score: number }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-2 text-center">
      <div className="text-sm font-semibold tabular-nums text-slate-900">{score.toFixed(1)}</div>
      <div className="mt-0.5 text-[10px] leading-tight text-slate-500">{label}</div>
    </div>
  );
}

// Renders a compact word-level diff (from targeted-revise's guardrail) with additions/
// removals highlighted, so a reviewer can confirm exactly what changed without reading two
// full blocks of text.
function DiffView({ diffSummaryJson }: { diffSummaryJson: string }) {
  let parts: DiffPart[];
  try {
    const parsed = JSON.parse(diffSummaryJson);
    if (!Array.isArray(parsed)) return null;
    parts = parsed;
  } catch {
    return null;
  }
  if (parts.length === 0) return null;

  return (
    <p className="mt-1.5 whitespace-pre-wrap break-words rounded-md bg-slate-50 px-2 py-1.5 text-[11px] leading-relaxed">
      {parts.map((part, i) =>
        part.added ? (
          <span key={i} className="rounded bg-emerald-100 px-0.5 text-emerald-800">
            {part.value}
          </span>
        ) : part.removed ? (
          <span key={i} className="rounded bg-red-100 px-0.5 text-red-700 line-through">
            {part.value}
          </span>
        ) : (
          <span key={i} className="text-slate-500">
            {part.value}
          </span>
        ),
      )}
    </p>
  );
}

function RevisionEntryRow({ entry }: { entry: RevisionHistoryEntry }) {
  const hasBefore = typeof entry.score_before === "number";
  const hasAfter = typeof entry.score_after === "number";
  const scoreImproved = hasBefore && hasAfter && (entry.score_after as number) > (entry.score_before as number);
  const scoreColor = !hasBefore || !hasAfter ? "text-slate-500" : scoreImproved ? "text-emerald-600" : "text-amber-600";

  return (
    <div className="rounded-md border border-slate-200 px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium text-slate-700">
          Revision {entry.revision_number} — {ROLE_LABEL[entry.triggered_by]} — {relativeTime(entry.timestamp)}
        </p>
        {entry.approval_status_after === "reject" && (
          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-red-600">
            <XCircle className="h-3 w-3" />
            Rejected
          </span>
        )}
      </div>

      {entry.target && (
        <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-indigo-600">
          {entry.target === "submission_status" || entry.target === "approval_status"
            ? STATUS_LOG_LABELS[entry.target]
            : `Targeted edit — ${REVISION_TARGET_LABELS[entry.target]}`}
        </p>
      )}

      {entry.reviewer_notes && (
        <blockquote className="mt-1 border-l-2 border-slate-200 pl-2 text-[11px] italic leading-relaxed text-slate-500">
          {entry.reviewer_notes}
        </blockquote>
      )}

      {entry.diff_summary && <DiffView diffSummaryJson={entry.diff_summary} />}

      {hasAfter && (
        <p className={`mt-1.5 text-[11px] font-semibold tabular-nums ${scoreColor}`}>
          {hasBefore
            ? `${(entry.score_before as number).toFixed(1)} → ${(entry.score_after as number).toFixed(1)}`
            : (entry.score_after as number).toFixed(1)}
        </p>
      )}
    </div>
  );
}

function KeywordChips({ label, keywords }: { label: string; keywords: string[] }) {
  if (keywords.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {keywords.map((k) => (
          <span key={k} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

export function EvaluationPanel({
  evaluationScore,
  evaluationReport,
  researchedKeywords,
  revisionHistory,
}: {
  evaluationScore: number;
  evaluationReport: EvaluationReportDetail | null | undefined;
  researchedKeywords?: ResearchedKeywords;
  revisionHistory?: RevisionHistoryEntry[];
}) {
  const [rubricOpen, setRubricOpen] = useState(false);
  const [keywordsOpen, setKeywordsOpen] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);

  const hasKeywords =
    !!researchedKeywords &&
    ((researchedKeywords.short_tail?.length ?? 0) > 0 || (researchedKeywords.long_tail?.length ?? 0) > 0);

  if (!evaluationReport) {
    return (
      <div className="divide-y divide-slate-200">
        <div className="p-4 text-xs text-slate-400">Evaluation will appear once a draft has been generated.</div>
        {hasKeywords && (
          <KeywordsSection open={keywordsOpen} onToggle={() => setKeywordsOpen((v) => !v)} keywords={researchedKeywords!} />
        )}
      </div>
    );
  }

  const sortedRevisionHistory = [...(revisionHistory ?? [])].sort((a, b) => b.revision_number - a.revision_number);
  const subscores = evaluationReport.scores;
  // Real rows have shown up with `scores: {}` (truthy but empty) — check for at least one
  // actual numeric field, not just that the object exists, so the grid never renders hollow.
  const hasSubscores = !!subscores && SUBSCORE_ORDER.some((key) => typeof subscores[key] === "number");
  const channelFit = evaluationReport.channel_fit;
  const channelFitEntries = channelFit ? CHANNEL_FIT_ORDER.filter((key) => channelFit[key]) : [];

  return (
    <div className="divide-y divide-slate-200">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Self-Evaluation</span>
          <ScoreBadge score={evaluationScore} />
        </div>

        <button
          type="button"
          onClick={() => setRubricOpen((v) => !v)}
          className="mt-3 flex w-full items-center justify-between text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          Full rubric breakdown
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${rubricOpen ? "rotate-180" : ""}`} />
        </button>

        {rubricOpen && (
          <div className="mt-3 space-y-3">
            {hasSubscores ? (
              <div className="grid grid-cols-2 gap-2">
                {SUBSCORE_ORDER.filter((key) => typeof subscores![key] === "number").map((key) => (
                  <SubscoreTile key={key} label={SUBSCORE_LABELS[key]} score={subscores![key] as number} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Detailed score breakdown not available for this draft.</p>
            )}

            {evaluationReport.critique && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500">Critique</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{evaluationReport.critique}</p>
              </div>
            )}

            {evaluationReport.weak_sections && evaluationReport.weak_sections.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500">Sections flagged as weak</p>
                <ul className="mt-1 list-inside list-disc space-y-1 text-[11px] text-slate-500">
                  {evaluationReport.weak_sections.map((section) => (
                    <li key={section}>{section}</li>
                  ))}
                </ul>
              </div>
            )}

            {evaluationReport.recommended_changes && evaluationReport.recommended_changes.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500">Recommended changes</p>
                <ul className="mt-1 list-inside list-disc space-y-1 text-[11px] text-slate-500">
                  {evaluationReport.recommended_changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </div>
            )}

            {channelFitEntries.length > 0 && (
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-slate-500">Channel fit</p>
                  {typeof channelFit!.overall_channel_fit_pass === "boolean" && (
                    <span
                      className={`text-[10px] font-medium ${
                        channelFit!.overall_channel_fit_pass ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      {channelFit!.overall_channel_fit_pass ? "All channels pass" : "Needs attention"}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] text-slate-400">Doesn&apos;t affect the article&apos;s own approval status.</p>
                <div className="mt-1.5 space-y-1.5">
                  {channelFitEntries.map((key) => {
                    const entry = channelFit![key]!;
                    return (
                      <div key={key} className="rounded-md border border-slate-200 px-2 py-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-medium text-slate-700">{CHANNEL_FIT_LABELS[key]}</span>
                          <span
                            className={`inline-flex items-center gap-1 font-medium ${
                              entry.passes_checklist ? "text-emerald-600" : "text-red-600"
                            }`}
                          >
                            {entry.passes_checklist ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            {entry.passes_checklist ? "Passes" : "Issues found"}
                          </span>
                        </div>
                        {!entry.passes_checklist && (
                          <>
                            {entry.violations && entry.violations.length > 0 ? (
                              <ul className="mt-1 list-inside list-disc space-y-0.5 text-[10px] text-slate-500">
                                {entry.violations.map((v) => (
                                  <li key={v}>{v}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-1 text-[10px] text-slate-400">No specific violations listed.</p>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {hasKeywords && (
        <KeywordsSection open={keywordsOpen} onToggle={() => setKeywordsOpen((v) => !v)} keywords={researchedKeywords!} />
      )}

      <div className="p-4">
        <button
          type="button"
          onClick={() => setRevisionsOpen((v) => !v)}
          className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          <span className="inline-flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" />
            Revision summary
          </span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${revisionsOpen ? "rotate-180" : ""}`} />
        </button>

        {revisionsOpen &&
          (sortedRevisionHistory.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400">Revision history not available for this draft.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {sortedRevisionHistory.map((entry) => (
                <RevisionEntryRow key={entry.revision_number} entry={entry} />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}

function KeywordsSection({
  open,
  onToggle,
  keywords,
}: {
  open: boolean;
  onToggle: () => void;
  keywords: ResearchedKeywords;
}) {
  return (
    <div className="p-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500"
      >
        <span className="inline-flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5" />
          Keywords targeted
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-3 space-y-2.5">
          <KeywordChips label="Short-tail" keywords={keywords.short_tail ?? []} />
          <KeywordChips label="Long-tail" keywords={keywords.long_tail ?? []} />
        </div>
      )}
    </div>
  );
}
