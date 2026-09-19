"use client";

import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";
import type { ContentRequestStatus } from "@/lib/content-request";

export interface SimilarMatch {
  id: string;
  topic: string;
  title: string | null;
  status: ContentRequestStatus;
  reason: string;
}

function humanizeStatus(status: string): string {
  return status
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function SimilarTopicDialog({
  matches,
  onCancel,
  onProceed,
}: {
  matches: SimilarMatch[];
  onCancel: () => void;
  onProceed: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" onClick={onCancel}>
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50">
            <AlertTriangle className="h-4.5 w-4.5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Similar content already exists</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              This topic looks like it may overlap with {matches.length === 1 ? "a request" : "requests"} already in
              the pipeline. Review below, or proceed if this is genuinely a different angle.
            </p>
          </div>
        </div>

        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
          {matches.map((m) => (
            <div key={m.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{m.title?.trim() || m.topic}</p>
                <span className="inline-flex shrink-0 items-center rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                  {humanizeStatus(m.status)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600">{m.reason}</p>
              <Link
                href={`/dashboard/${m.id}/review`}
                target="_blank"
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                Open in dashboard
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onProceed}
            className="rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Proceed anyway
          </button>
        </div>
      </div>
    </div>
  );
}
