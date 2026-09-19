import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { RevisionHistoryEntry } from "@/lib/content-request";
import { getRoleFromHeaders } from "@/lib/role";
import { revertStatusWithLog } from "@/lib/revert-status";

// Lets a Manager pull a request back out of "approved" for another look before it's actually
// gone out — e.g. they approved too quickly and want to reconsider or ask for a tweak first.
// Pure status reversal: never touches article_draft/channel_variants/evaluation_report.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/content-requests/[id]/recall-approval">) {
  const { id } = await ctx.params;
  const role = getRoleFromHeaders(req.headers);

  if (role !== "manager") {
    return NextResponse.json({ error: "Only a Manager can recall an approval." }, { status: 403 });
  }

  const { data: current, error: fetchError } = await getSupabaseAdmin()
    .from("content_requests")
    .select("status, revision_history, newsletter_sent_at")
    .eq("id", id)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: "Content request not found." }, { status: 404 });
  }

  if (current.newsletter_sent_at) {
    return NextResponse.json({ error: "This has already been sent and can no longer be recalled." }, { status: 409 });
  }

  if (current.status !== "approved") {
    return NextResponse.json(
      { error: `This request is not currently approved (status: ${current.status}) and cannot be recalled.` },
      { status: 409 },
    );
  }

  const updated = await revertStatusWithLog({
    id,
    fromStatus: "approved",
    toStatus: "submitted_for_approval",
    existingHistory: (current.revision_history ?? []) as RevisionHistoryEntry[],
    triggeredBy: "manager",
    reviewerNotes: "Recalled approval for further review",
    target: "approval_status",
    requireNewsletterNotSent: true,
  });

  if (!updated) {
    return NextResponse.json(
      { error: "Could not recall this approval — it may have already changed." },
      { status: 409 },
    );
  }

  return NextResponse.json(updated);
}
