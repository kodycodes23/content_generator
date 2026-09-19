"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, FileText, Paperclip, Quote, ShieldCheck } from "lucide-react";
import type { ContentRequestSource, EvaluationReportDetail } from "@/lib/content-request";
import { relativeTime } from "@/lib/format";

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(url);
}

interface SourceGroup {
  source_title: string;
  source_url: string;
  facts: string[];
}

// The research step sometimes pulls several distinct facts from the same underlying page —
// that's several citations, not several sources. Grouping by URL (falling back to title if
// a source has no URL) keeps the panel honest about how many places were actually consulted,
// instead of rendering one identical-looking card per fact.
function groupSourcesByUrl(sources: ContentRequestSource[]): SourceGroup[] {
  const groups: SourceGroup[] = [];
  const indexByKey = new Map<string, number>();

  for (const source of sources) {
    const key = source.source_url || source.source_title;
    const existingIndex = indexByKey.get(key);
    if (existingIndex !== undefined) {
      groups[existingIndex].facts.push(source.fact);
      continue;
    }
    indexByKey.set(key, groups.length);
    groups.push({ source_title: source.source_title, source_url: source.source_url, facts: [source.fact] });
  }

  return groups;
}

function SourceCard({ group, defaultOpen }: { group: SourceGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-slate-900">{group.source_title}</span>
          {group.source_url && (
            <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-400">
              <ExternalLink className="h-3 w-3 shrink-0" />
              {hostnameOf(group.source_url)}
            </span>
          )}
        </span>
        {group.facts.length > 1 && (
          <span className="mt-0.5 shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            {group.facts.length} citations
          </span>
        )}
        <ChevronDown
          className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-3.5 py-3">
          <div className="space-y-2.5">
            {group.facts.map((fact, i) => (
              <blockquote key={i} className="flex gap-2 text-xs leading-relaxed text-slate-600">
                <Quote className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                <span>{fact}</span>
              </blockquote>
            ))}
          </div>

          {group.source_url && (
            <div className="mt-3 flex justify-end">
              <a
                href={group.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 hover:text-indigo-800"
              >
                Open source
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SourceViewer({
  sources,
  evaluationReport,
  researchedAt,
  attachmentUrl,
}: {
  sources: ContentRequestSource[];
  evaluationReport: EvaluationReportDetail | null | undefined;
  researchedAt: string | undefined;
  attachmentUrl?: string | null;
}) {
  const groups = groupSourcesByUrl(sources);
  const citationCount = sources.length;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-4 py-3.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5" />
          Sources &amp; Verification
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          {groups.length} {groups.length === 1 ? "source" : "sources"}
          {citationCount > groups.length ? ` · ${citationCount} citations` : ""} informed this draft
          {typeof evaluationReport?.scores?.grounding === "number"
            ? ` · grounding ${evaluationReport.scores.grounding.toFixed(1)}/10`
            : ""}
        </p>
        {researchedAt && (
          <p className="mt-0.5 text-[11px] text-slate-400">
            Researched {relativeTime(researchedAt)}
            <span className="text-slate-300"> · overall request time, not per-source</span>
          </p>
        )}

        {attachmentUrl &&
          (isImageUrl(attachmentUrl) ? (
            <a
              href={attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2.5 block overflow-hidden rounded-md border border-slate-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachmentUrl} alt="Supporting attachment" className="h-24 w-full object-cover" />
            </a>
          ) : (
            <a
              href={attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
            >
              <Paperclip className="h-3 w-3" />
              View attachment
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto p-3 scrollbar-thin">
        {sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-xs text-slate-400">
            <FileText className="h-5 w-5" />
            No sources extracted yet.
          </div>
        ) : (
          groups.map((group, i) => (
            <SourceCard key={`${group.source_url}-${i}`} group={group} defaultOpen={i === 0} />
          ))
        )}
      </div>
    </div>
  );
}
