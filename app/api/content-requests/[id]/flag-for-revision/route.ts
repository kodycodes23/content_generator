import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeContentRequestRow, type RawContentRequestRow } from "@/lib/content-request";
import { getRoleFromHeaders } from "@/lib/role";
import { sendRevisionRequestedEmail } from "@/lib/email";

// Manager's "Request Revision" — a note-only handoff back to the writer, who then does the
// actual revision themselves (via /targeted-revise or /deep-revise). Pure Supabase update,
// same shape as approve/reject — deliberately does not touch content or call any AI.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/content-requests/[id]/flag-for-revision">) {
  const { id } = await ctx.params;
  const role = getRoleFromHeaders(req.headers);

  if (role !== "manager") {
    return NextResponse.json({ error: "Only a Manager can flag a request for revision this way." }, { status: 403 });
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
    return NextResponse.json({ error: "Notes must be at least 5 characters." }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("content_requests")
    .update({ status: "revision_requested", reviewer_notes: reviewerNotes })
    .eq("id", id)
    .eq("status", "submitted_for_approval")
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Could not flag this request for revision — it may not be submitted for approval anymore." },
      { status: 409 },
    );
  }

  const request = normalizeContentRequestRow(data as RawContentRequestRow);
  await sendRevisionRequestedEmail({ id: request.id, title: request.title, reviewerNotes });

  return NextResponse.json(request);
}
