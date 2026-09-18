"use client";

import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABEL, type Role } from "@/lib/role";

export interface ClientErrorRow {
  id: string;
  created_at: string;
  source: string;
  message: string;
  stack: string | null;
  url: string | null;
  role: string | null;
  context: Record<string, unknown> | null;
}

const SOURCE_LABEL: Record<string, string> = {
  window_error: "Uncaught exception",
  unhandled_rejection: "Unhandled rejection",
  react_error_boundary: "React crash",
  action_failed: "Action failed",
};

const SOURCE_STYLE: Record<string, string> = {
  window_error: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  unhandled_rejection: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  react_error_boundary: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  action_failed: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
};

const FILTERS: { key: "all" | string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "action_failed", label: "Action failed" },
  { key: "window_error", label: "Uncaught exception" },
  { key: "unhandled_rejection", label: "Unhandled rejection" },
  { key: "react_error_boundary", label: "React crash" },
];

export function ErrorLogTable({ errors }: { errors: ClientErrorRow[] }) {
  const [filter, setFilter] = useState<string>("all");

  const filtered = useMemo(
    () => (filter === "all" ? errors : errors.filter((e) => e.source === filter)),
    [errors, filter],
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: errors.length };
    for (const e of errors) map[e.source] = (map[e.source] ?? 0) + 1;
    return map;
  }, [errors]);

  if (errors.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="No errors reported"
        description="Nothing has been logged from the frontend yet — uncaught exceptions, unhandled promise rejections, React crashes, and failed actions will show up here as they happen."
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.label}
            <span className={filter === f.key ? "text-slate-300" : "text-slate-400"}>{counts[f.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Time</th>
              <th className="px-4 py-2.5">Source</th>
              <th className="px-4 py-2.5">Message</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">Page</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((e) => (
              <ErrorRow key={e.id} error={e} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ErrorRow({ error }: { error: ClientErrorRow }) {
  const hasDetails = !!(error.stack || error.context);
  const pagePath = error.url ? safePathFromUrl(error.url) : null;

  return (
    <tr className="align-top hover:bg-slate-50">
      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDateTime(error.created_at)}</td>
      <td className="whitespace-nowrap px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
            SOURCE_STYLE[error.source] ?? "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200"
          }`}
        >
          {SOURCE_LABEL[error.source] ?? error.source}
        </span>
      </td>
      <td className="max-w-md px-4 py-3">
        <p className="break-words text-slate-800">{error.message}</p>
        {hasDetails && (
          <details className="mt-1.5 group">
            <summary className="cursor-pointer text-[11px] font-medium text-slate-400 hover:text-slate-600">
              Details
            </summary>
            <div className="mt-2 space-y-2">
              {error.stack && (
                <pre className="max-h-64 overflow-auto rounded-md bg-slate-900 p-2.5 text-[11px] leading-relaxed text-slate-100">
                  {error.stack}
                </pre>
              )}
              {error.context && (
                <pre className="max-h-40 overflow-auto rounded-md bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-600 ring-1 ring-inset ring-slate-200">
                  {JSON.stringify(error.context, null, 2)}
                </pre>
              )}
            </div>
          </details>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
        {error.role ? ROLE_LABEL[error.role as Role] ?? error.role : "—"}
      </td>
      <td className="max-w-[14rem] truncate px-4 py-3 text-xs text-slate-400" title={error.url ?? undefined}>
        {pagePath ?? "—"}
      </td>
    </tr>
  );
}

function safePathFromUrl(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
