// Only StatusPill and ScoreBadge remain in active use (by EvaluationPanel, ReviewWorkspace,
// ContentTable) — the rest of what used to live in this file was the standalone review UI
// for the old local-file dashboard (ContentRequestsDashboard, /dashboard/requests), removed
// once that flow was retired in favor of /dashboard/[id]/review.
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ContentRequestStatus } from "@/lib/content-request";

export type { ChannelVariants, ContentRequest, ContentRequestSource, ContentRequestStatus } from "@/lib/content-request";

const STATUS_STYLES: Record<ContentRequestStatus, string> = {
  researching: "bg-blue-50 text-blue-700 border-blue-200",
  pending_human_review: "bg-amber-50 text-amber-800 border-amber-200",
  submitted_for_approval: "bg-cyan-50 text-cyan-700 border-cyan-200",
  revision_requested: "bg-violet-50 text-violet-700 border-violet-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  published: "bg-slate-900 text-white border-slate-900",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

function humanizeStatus(status: string): string {
  return status
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function StatusPill({ status }: { status: ContentRequestStatus }) {
  const style = STATUS_STYLES[status] ?? "bg-secondary text-secondary-foreground border-transparent";
  return <Badge className={cn("border font-medium", style)}>{humanizeStatus(status)}</Badge>;
}

export function ScoreBadge({ score }: { score: number }) {
  const good = score >= 8.0;
  return (
    <Badge
      className={cn(
        "border font-semibold tabular-nums",
        good ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200",
      )}
    >
      {score.toFixed(1)} / 10
    </Badge>
  );
}
