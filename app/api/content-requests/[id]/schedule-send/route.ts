import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeContentRequestRow, type RawContentRequestRow } from "@/lib/content-request";

// Sets (or clears) scheduled_send_at only — no Resend call happens here. The actual send
// is fired later by the cron-checked app/api/cron/send-scheduled-newsletters route, which
// reuses the same lib/newsletter.ts logic as the immediate send-newsletter route.
//
// Either role may schedule or cancel — status === "approved" (enforced below) is the real
// gate: a Writer can't schedule something a Manager hasn't approved yet, but once it's
// approved, either of them can be the one to schedule (or cancel) the send.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/content-requests/[id]/schedule-send">) {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const raw = (body as { scheduled_send_at?: unknown } | null)?.scheduled_send_at;
  let scheduledSendAt: string | null;

  if (raw === null) {
    scheduledSendAt = null; // cancelling an existing schedule
  } else if (typeof raw === "string") {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "scheduled_send_at must be a valid date/time." }, { status: 400 });
    }
    if (parsed.getTime() <= Date.now()) {
      return NextResponse.json({ error: "scheduled_send_at must be in the future." }, { status: 400 });
    }
    scheduledSendAt = parsed.toISOString();
  } else {
    return NextResponse.json({ error: "scheduled_send_at must be an ISO date string or null." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: current, error: fetchError } = await supabaseAdmin
    .from("content_requests")
    .select("status, newsletter_sent_at")
    .eq("id", id)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: "Content request not found." }, { status: 404 });
  }

  if (current.newsletter_sent_at) {
    return NextResponse.json(
      { error: "This request is locked — its newsletter has already been sent." },
      { status: 409 },
    );
  }

  // Setting a new schedule requires the request still be approved; cancelling one doesn't —
  // either role should always be able to back out of a pending schedule (e.g. even if the
  // request was separately marked published in the meantime), only sending itself is gated.
  if (scheduledSendAt !== null && current.status !== "approved") {
    return NextResponse.json(
      { error: "The newsletter can only be scheduled while a request is approved." },
      { status: 409 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("content_requests")
    .update({ scheduled_send_at: scheduledSendAt })
    .eq("id", id)
    .is("newsletter_sent_at", null)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Could not update the schedule — please try again." }, { status: 500 });
  }

  return NextResponse.json(normalizeContentRequestRow(data as RawContentRequestRow));
}
