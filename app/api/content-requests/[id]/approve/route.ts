import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeContentRequestRow, type RawContentRequestRow } from "@/lib/content-request";
import { getRoleFromHeaders } from "@/lib/role";
import { sendDecisionEmail } from "@/lib/email";

export async function POST(req: Request, ctx: RouteContext<"/api/content-requests/[id]/approve">) {
  const { id } = await ctx.params;
  const role = getRoleFromHeaders(req.headers);

  if (role !== "manager") {
    return NextResponse.json({ error: "Only a Manager can approve a request." }, { status: 403 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("content_requests")
    .update({ status: "approved" })
    .eq("id", id)
    .eq("status", "submitted_for_approval")
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Could not approve this request — it may not be submitted for approval anymore." },
      { status: 409 },
    );
  }

  const request = normalizeContentRequestRow(data as RawContentRequestRow);
  await sendDecisionEmail({ id: request.id, title: request.title, decision: "approved" });

  return NextResponse.json(request);
}
