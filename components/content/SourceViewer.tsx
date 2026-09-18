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

function SourceCard({ source, defaultOpen }: { source: ContentRequestSource; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-slate-900">{source.source_title}</span>
          {source.source_url && (
            <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-400">
              <ExternalLink className="h-3 w-3 shrink-0" />
              {hostnameOf(source.source_url)}
            </span>
          )}
        </span>
        <ChevronDown
          className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-3.5 py-3">
          <blockquote className="flex gap-2 text-xs leading-relaxed text-slate-600">
            <Quote className="h-3.5 w-3.5 shrink-0 text-slate-300" />
            <span>{source.fact}</span>
          </blockquote>

          {source.source_url && (
            <div className="mt-3 flex justify-end">
              <a
                href={source.source_url}
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
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-4 py-3.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5" />
          Sources &amp; Verification
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          {sources.length} {sources.length === 1 ? "source" : "sources"} informed this draft
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
          sources.map((source, i) => (
            <SourceCard key={`${source.source_url}-${i}`} source={source} defaultOpen={i === 0} />
          ))
        )}
      </div>
    </div>
  );
}
