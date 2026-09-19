import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeContentRequestRow, type RawContentRequestRow, type RevisionHistoryEntry } from "@/lib/content-request";
import { getRoleFromHeaders } from "@/lib/role";

// Lets a Content Writer pull a request back out of the approval queue before a Manager has
// acted on it — e.g. they noticed a mistake right after hitting "Send for Approval". Pure
// status reversal: never touches article_draft/channel_variants/evaluation_report, so the
// writer can edit and resend exactly what they had.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/content-requests/[id]/recall">) {
  const { id } = await ctx.params;
  const role = getRoleFromHeaders(req.headers);

  if (role !== "content_writer") {
    return NextResponse.json({ error: "Only a Content Writer can recall a submission." }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: current, error: fetchError } = await supabaseAdmin
    .from("content_requests")
    .select("status, revision_history")
    .eq("id", id)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: "Content request not found." }, { status: 404 });
  }

  if (current.status !== "submitted_for_approval") {
    return NextResponse.json(
      { error: "This request has already been reviewed and can no longer be recalled." },
      { status: 409 },
    );
  }

  const existingHistory = (current.revision_history ?? []) as RevisionHistoryEntry[];
  const newEntry: RevisionHistoryEntry = {
    revision_number: existingHistory.length + 1,
    timestamp: new Date().toISOString(),
    triggered_by: "content_writer",
    reviewer_notes: "Recalled from approval queue",
    score_before: null,
    score_after: null,
    approval_status_after: null,
  };

  const { data, error } = await supabaseAdmin
    .from("content_requests")
    .update({ status: "pending_human_review", revision_history: [...existingHistory, newEntry] })
    .eq("id", id)
    .eq("status", "submitted_for_approval")
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "This request has already been reviewed and can no longer be recalled." },
      { status: 409 },
    );
  }

  return NextResponse.json(normalizeContentRequestRow(data as RawContentRequestRow));
}
