import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeContentRequestRow, type ContentRequest, type RawContentRequestRow } from "@/lib/content-request";
import { FIXTURES } from "@/lib/content-request-fixtures";
import { ReviewWorkspace } from "@/components/content/ReviewWorkspace";

export const dynamic = "force-dynamic";

async function loadContentRequest(id: string): Promise<ContentRequest | null> {
  const fixture = Object.values(FIXTURES).find((f) => f.id === id);
  if (fixture) return fixture;

  try {
    const { data, error } = await getSupabaseAdmin().from("content_requests").select("*").eq("id", id).single();
    if (error || !data) return null;
    return normalizeContentRequestRow(data as RawContentRequestRow);
  } catch {
    return null;
  }
}

export default async function ReviewPage(props: PageProps<"/dashboard/[id]/review">) {
  const { id } = await props.params;
  const request = await loadContentRequest(id);

  if (!request) notFound();

  return <ReviewWorkspace initialRequest={request} />;
}
