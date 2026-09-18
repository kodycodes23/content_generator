import { getSupabaseAdmin } from "@/lib/supabase";
import { RefreshButton } from "@/components/content/RefreshButton";
import { ErrorLogTable, type ClientErrorRow } from "@/components/content/ErrorLogTable";

export const dynamic = "force-dynamic";

async function loadErrors(): Promise<ClientErrorRow[]> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("client_errors")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;
    return (data ?? []) as ClientErrorRow[];
  } catch (err) {
    console.error("[dashboard/errors] Supabase fetch failed:", err);
    return [];
  }
}

export default async function ErrorsPage() {
  const errors = await loadErrors();

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Error log</h1>
          <p className="mt-1 text-sm text-slate-500">
            Frontend errors reported automatically — uncaught exceptions, unhandled promise rejections, React
            crashes, and failed action calls. Most recent 200, newest first.
          </p>
        </div>
        <RefreshButton />
      </div>

      <ErrorLogTable errors={errors} />
    </div>
  );
}
