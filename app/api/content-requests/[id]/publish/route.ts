import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeContentRequestRow, type RawContentRequestRow } from "@/lib/content-request";
import { getRoleFromHeaders } from "@/lib/role";
import { sendPublishedEmail } from "@/lib/email";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/content-requests/[id]/publish">) {
  const { id } = await ctx.params;
  const role = getRoleFromHeaders(req.headers);

  if (role !== "manager") {
    return NextResponse.json({ error: "Only a Manager can mark a request as published." }, { status: 403 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("content_requests")
    .update({ status: "published" })
    .eq("id", id)
    .eq("status", "approved")
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Could not mark this request as published — it may not be approved anymore." },
      { status: 409 },
    );
  }

  const request = normalizeContentRequestRow(data as RawContentRequestRow);

  // The newsletter itself is sent separately via /send-newsletter, deliberately, with its
  // own confirmation step and its own newsletter_sent_at lock — this route no longer fires
  // it automatically to avoid a duplicate/unconfirmed send bypassing that flow.
  await sendPublishedEmail({ id: request.id, title: request.title });

  return NextResponse.json(request);
}
