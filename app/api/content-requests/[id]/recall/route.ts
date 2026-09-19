import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { RevisionHistoryEntry } from "@/lib/content-request";
import { getRoleFromHeaders } from "@/lib/role";
import { revertStatusWithLog } from "@/lib/revert-status";

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

  const { data: current, error: fetchError } = await getSupabaseAdmin()
    .from("content_requests")
    .select("status, revision_history")
    .eq("id", id)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: "Content request not found." }, { status: 404 });
  }

  const alreadyReviewedMessage = "This request has already been reviewed and can no longer be recalled.";
  if (current.status !== "submitted_for_approval") {
    return NextResponse.json({ error: alreadyReviewedMessage }, { status: 409 });
  }

  const updated = await revertStatusWithLog({
    id,
    fromStatus: "submitted_for_approval",
    toStatus: "pending_human_review",
    existingHistory: (current.revision_history ?? []) as RevisionHistoryEntry[],
    triggeredBy: "content_writer",
    reviewerNotes: "Recalled from approval queue",
    target: "submission_status",
  });

  if (!updated) {
    return NextResponse.json({ error: alreadyReviewedMessage }, { status: 409 });
  }

  return NextResponse.json(updated);
}
