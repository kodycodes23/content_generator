import { FileSearch } from "lucide-react";
import { EmptyState } from "@/components/content/EmptyState";

export default function ReviewNotFound() {
  return (
    <div className="mx-auto max-w-lg px-8 py-16">
      <EmptyState
        icon={FileSearch}
        title="Content request not found"
        description="This request may have been removed, or the link is out of date."
        actionHref="/dashboard"
        actionLabel="Back to overview"
      />
    </div>
  );
}
