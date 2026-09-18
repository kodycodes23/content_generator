import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeContentRequestRow, type RawContentRequestRow } from "@/lib/content-request";
import { getRoleFromHeaders } from "@/lib/role";
import { sendDecisionEmail } from "@/lib/email";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/content-requests/[id]/reject">) {
  const { id } = await ctx.params;
  const role = getRoleFromHeaders(req.headers);

  if (role !== "manager") {
    return NextResponse.json({ error: "Only a Manager can reject a request." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const reviewerNotes =
    typeof (body as { reviewer_notes?: unknown })?.reviewer_notes === "string"
      ? (body as { reviewer_notes: string }).reviewer_notes.trim()
      : "";

  if (reviewerNotes.length < 5) {
    return NextResponse.json({ error: "A rejection reason of at least 5 characters is required." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: current, error: fetchError } = await supabaseAdmin
    .from("content_requests")
    .select("newsletter_sent_at")
    .eq("id", id)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: "Content request not found." }, { status: 404 });
  }

  // Never trust the client alone: ActionBar already hides this action once the newsletter
  // has gone out, but the row is locked here too in case it's ever reachable another way.
  if (current.newsletter_sent_at) {
    return NextResponse.json(
      { error: "This request is locked — its newsletter has already been sent." },
      { status: 409 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("content_requests")
    .update({ status: "rejected", reviewer_notes: reviewerNotes })
    .eq("id", id)
    .eq("status", "submitted_for_approval")
    .is("newsletter_sent_at", null)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Could not reject this request — it may not be submitted for approval anymore." },
      { status: 409 },
    );
  }

  const request = normalizeContentRequestRow(data as RawContentRequestRow);
  await sendDecisionEmail({ id: request.id, title: request.title, decision: "rejected", reviewerNotes });

  return NextResponse.json(request);
}
