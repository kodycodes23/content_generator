import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeContentRequestRow, type RawContentRequestRow } from "@/lib/content-request";

// Purely a manual override on one field — independent of the n8n pipeline. Never touches
// status, triggers a webhook, or changes anything else on the row.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/content-requests/[id]/set-image">) {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const featuredImageUrl = (body as { featured_image_url?: unknown })?.featured_image_url;
  if (typeof featuredImageUrl !== "string" || !featuredImageUrl.trim()) {
    return NextResponse.json({ error: "featured_image_url is required." }, { status: 400 });
  }

  try {
    new URL(featuredImageUrl);
  } catch {
    return NextResponse.json({ error: "featured_image_url must be a valid URL." }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("content_requests")
    .update({ featured_image_url: featuredImageUrl.trim() })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `Could not update the image: ${error?.message ?? "request not found"}` },
      { status: 500 },
    );
  }

  return NextResponse.json(normalizeContentRequestRow(data as RawContentRequestRow));
}
