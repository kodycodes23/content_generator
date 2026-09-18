import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeContentRequestRow, type RawContentRequestRow } from "@/lib/content-request";

const ATTACHMENT_BUCKET = "content-attachments";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/content-requests/[id]">) {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const { title, article_draft } = (body ?? {}) as { title?: unknown; article_draft?: unknown };
  if (typeof article_draft !== "string") {
    return NextResponse.json({ error: "article_draft is required." }, { status: 400 });
  }

  const update: Record<string, unknown> = { article_draft };
  if (typeof title === "string" && title.trim()) update.title = title.trim();

  const { data, error } = await getSupabaseAdmin()
    .from("content_requests")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `Could not save changes: ${error?.message ?? "request not found"}` },
      { status: 500 },
    );
  }

  return NextResponse.json(normalizeContentRequestRow(data as RawContentRequestRow));
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/content-requests/[id]">) {
  const { id } = await ctx.params;
  const supabaseAdmin = getSupabaseAdmin();

  // Best-effort: clean up any uploaded attachment so deleting a row doesn't leave an
  // orphaned file behind — a storage hiccup shouldn't block the row deletion itself, which
  // is the actual point of this action.
  try {
    const { data: files } = await supabaseAdmin.storage.from(ATTACHMENT_BUCKET).list(id);
    if (files && files.length > 0) {
      await supabaseAdmin.storage.from(ATTACHMENT_BUCKET).remove(files.map((f) => `${id}/${f.name}`));
    }
  } catch (err) {
    console.error(`[content-requests] Could not clean up attachment for ${id}:`, err);
  }

  const { error } = await supabaseAdmin.from("content_requests").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: `Could not delete this request: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ id });
}
