import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeContentRequestRow, type ContentRequest, type RawContentRequestRow } from "@/lib/content-request";
import { ContentTable } from "@/components/content/ContentTable";
import { RefreshButton } from "@/components/content/RefreshButton";

export const dynamic = "force-dynamic";

async function loadLiveRows(): Promise<ContentRequest[]> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("content_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return ((data ?? []) as RawContentRequestRow[]).map(normalizeContentRequestRow);
  } catch (err) {
    console.error("[dashboard] Supabase fetch failed:", err);
    return [];
  }
}

export default async function DashboardPage() {
  const liveRows = await loadLiveRows();

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Content requests</h1>
          <p className="mt-1 text-sm text-slate-500">Live from Supabase — hit refresh to pull the latest.</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton />
          <Link
            href="/dashboard/new"
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            <PlusCircle className="h-4 w-4" strokeWidth={1.75} />
            New request
          </Link>
        </div>
      </div>

      <ContentTable rows={liveRows} emptyMessage="Kick off a new request to start the research and generation pipeline." />
    </div>
  );
}
