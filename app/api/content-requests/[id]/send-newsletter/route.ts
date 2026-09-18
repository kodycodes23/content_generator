import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeContentRequestRow, type RawContentRequestRow } from "@/lib/content-request";
import { sendNewsletterEmail } from "@/lib/newsletter";

// Either role may trigger this — status === "approved" (enforced by the atomic claim below)
// is the real gate: a Writer can't send something a Manager hasn't approved yet, but once
// it's approved, either of them can be the one to actually fire it off.
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/content-requests/[id]/send-newsletter">) {
  const { id } = await ctx.params;

  const supabaseAdmin = getSupabaseAdmin();

  const { data: existingRow, error: fetchError } = await supabaseAdmin
    .from("content_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existingRow) {
    return NextResponse.json({ error: "Content request not found." }, { status: 404 });
  }

  const existing = normalizeContentRequestRow(existingRow as RawContentRequestRow);
  const newsletter = existing.channel_variants?.newsletter;

  if (!newsletter || !newsletter.body_markdown?.trim()) {
    return NextResponse.json({ error: "This request has no newsletter content to send." }, { status: 400 });
  }

  // Atomically claim the send before actually emailing anything — closes the race where a
  // double-click (or the Writer and Manager both trying) could pass validation and fire
  // the email twice.
  const { data: claimedRow, error: claimError } = await supabaseAdmin
    .from("content_requests")
    .update({ newsletter_sent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "approved")
    .is("newsletter_sent_at", null)
    .select("*")
    .single();

  if (claimError || !claimedRow) {
    return NextResponse.json(
      { error: "Could not send the newsletter — this request may not be approved anymore, or it was already sent." },
      { status: 409 },
    );
  }

  const request = normalizeContentRequestRow(claimedRow as RawContentRequestRow);

  try {
    await sendNewsletterEmail(newsletter, request.title);
  } catch (err) {
    // The lock was claimed but nothing was actually delivered — release it so this can be retried.
    await supabaseAdmin.from("content_requests").update({ newsletter_sent_at: null }).eq("id", id);
    return NextResponse.json(
      { error: `Could not send the newsletter: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  return NextResponse.json(request);
}
