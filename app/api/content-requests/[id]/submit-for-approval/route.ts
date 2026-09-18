import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeContentRequestRow, type RawContentRequestRow } from "@/lib/content-request";
import { getRoleFromHeaders } from "@/lib/role";
import { sendSubmittedForApprovalEmail } from "@/lib/email";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/content-requests/[id]/submit-for-approval">) {
  const { id } = await ctx.params;
  const role = getRoleFromHeaders(req.headers);

  if (role !== "content_writer") {
    return NextResponse.json({ error: "Only a Content Writer can send a request for approval." }, { status: 403 });
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
    .update({ status: "submitted_for_approval" })
    .eq("id", id)
    .in("status", ["pending_human_review", "revision_requested"])
    .is("newsletter_sent_at", null)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        error:
          "Could not send this request for approval — it may have already moved on, or isn't ready to be sent.",
      },
      { status: 409 },
    );
  }

  const request = normalizeContentRequestRow(data as RawContentRequestRow);
  await sendSubmittedForApprovalEmail({ id: request.id, title: request.title });

  return NextResponse.json(request);
}
