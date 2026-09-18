import { STATUS_DOT, STATUS_LABEL, STATUS_STYLES } from "@/lib/format";
import type { ContentStatus } from "@/lib/types";

export function StatusBadge({ status, className = "" }: { status: ContentStatus; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}
