"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, Inbox, Link2, Search, Sparkles } from "lucide-react";
import { StatusPill, ScoreBadge } from "./ArticleReviewPanel";
import { EmptyState } from "./EmptyState";
import { RowMenu } from "./RowMenu";
import { useRequiredRole } from "./RoleContext";
import { CHANNEL_LABEL, relativeTime } from "@/lib/format";
import type { Channel, ContentRequest, ContentRequestStatus } from "@/lib/content-request";
import type { Role } from "@/lib/role";

// What "needs your attention" means depends on role: the writer is waiting to hand off
// or rework, the manager is waiting to decide.
const ATTENTION_STATUSES: Record<Role, ContentRequestStatus[]> = {
  content_writer: ["pending_human_review", "revision_requested"],
  manager: ["submitted_for_approval"],
};

const FILTERS: { key: "all" | "attention" | ContentRequestStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "attention", label: "Needs your attention" },
  { key: "researching", label: "Researching" },
  { key: "submitted_for_approval", label: "Submitted for approval" },
  { key: "revision_requested", label: "Revision requested" },
  { key: "approved", label: "Approved" },
  { key: "published", label: "Published" },
  { key: "rejected", label: "Rejected" },
];

export function ContentTable({
  rows,
  emptyMessage = "No content requests yet.",
}: {
  rows: ContentRequest[];
  emptyMessage?: string;
}) {
  const { role } = useRequiredRole();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [query, setQuery] = useState("");

  const attentionStatuses = ATTENTION_STATUSES[role];

  const filtered = useMemo(() => {
    let result = rows;
    if (filter === "attention") result = result.filter((r) => attentionStatuses.includes(r.status));
    else if (filter !== "all") result = result.filter((r) => r.status === filter);

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter((r) => r.title.toLowerCase().includes(q) || (r.topic ?? "").toLowerCase().includes(q));
    }

    return [...result].sort((a, b) => ((a.updated_at ?? "") < (b.updated_at ?? "") ? 1 : -1));
  }, [rows, filter, query, attentionStatuses]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: rows.length };
    for (const r of rows) map[r.status] = (map[r.status] ?? 0) + 1;
    map.attention = rows.filter((r) => attentionStatuses.includes(r.status)).length;
    return map;
  }, [rows, attentionStatuses]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {f.label}
              {counts[f.key] ? (
                <span className={`ml-1.5 tabular-nums ${filter === f.key ? "text-slate-300" : "text-slate-400"}`}>
                  {counts[f.key]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or topic"
            className="w-56 rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={rows.length === 0 ? "Nothing here yet" : "Nothing matches this filter"}
          description={rows.length === 0 ? emptyMessage : "Try a different status filter or clear your search."}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Score</th>
                <th className="px-4 py-2.5 font-medium">Channels</th>
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium">Updated</th>
                <th className="w-10 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((request) => {
                const channelTargets: Channel[] = request.channel_targets ?? [];
                return (
                  <tr
                    key={request.id}
                    className="group cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="max-w-xs px-4 py-3">
                      <Link href={`/dashboard/${request.id}/review`} className="block">
                        <div className="flex items-center gap-1.5 truncate font-medium text-slate-900">
                          {request.title}
                          {attentionStatuses.includes(request.status) && (
                            <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                          )}
                        </div>
                        {request.target_audience && (
                          <div className="mt-0.5 truncate text-xs text-slate-500">{request.target_audience}</div>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/${request.id}/review`}>
                        <StatusPill status={request.status} />
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/${request.id}/review`}>
                        {request.evaluation_report ? (
                          <ScoreBadge score={request.evaluation_score} />
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/${request.id}/review`} className="flex flex-wrap gap-1">
                        {channelTargets.length > 0 ? (
                          channelTargets.map((c) => (
                            <span
                              key={c}
                              className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-600"
                            >
                              {CHANNEL_LABEL[c]}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/${request.id}/review`}>
                        {request.source_url ? (
                          <span className="inline-flex items-center gap-1 text-xs text-indigo-600">
                            <Link2 className="h-3.5 w-3.5" />
                            Source URL
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Raw idea</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/${request.id}/review`}
                        className="flex items-center gap-1 text-xs text-slate-500"
                      >
                        {request.updated_at ? relativeTime(request.updated_at) : "—"}
                        <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </td>
                    <td className="px-2 py-3 text-right">
                      <RowMenu id={request.id} title={request.title} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
