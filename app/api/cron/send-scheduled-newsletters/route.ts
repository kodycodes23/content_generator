import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeContentRequestRow, type RawContentRequestRow } from "@/lib/content-request";
import { sendNewsletterEmail } from "@/lib/newsletter";

// Meant to be hit every 5-10 minutes by an external cron service (see deployment notes in
// the project — Vercel's free Cron tier only supports daily intervals, not precise enough
// for "send at this exact time"). Supports GET and POST since free cron-checking services
// vary in which method they default to.
function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_API_KEY;
  if (!expected) return false;
  return req.headers.get("authorization") === `Bearer ${expected}`;
}

interface RowResult {
  id: string;
  title: string;
  result: "sent" | "skipped" | "failed";
  reason?: string;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data: dueRows, error: queryError } = await supabaseAdmin
    .from("content_requests")
    .select("*")
    .not("scheduled_send_at", "is", null)
    .lte("scheduled_send_at", nowIso)
    .is("newsletter_sent_at", null);

  if (queryError) {
    return NextResponse.json({ error: `Could not query due newsletters: ${queryError.message}` }, { status: 500 });
  }

  const results: RowResult[] = [];

  for (const row of dueRows ?? []) {
    const request = normalizeContentRequestRow(row as RawContentRequestRow);

    try {
      // Atomically claim this row before sending — closes the race between overlapping
      // cron runs (e.g. a slow previous run still in flight when the next poll fires).
      const { data: claimedRow, error: claimError } = await supabaseAdmin
        .from("content_requests")
        .update({ newsletter_sent_at: new Date().toISOString() })
        .eq("id", request.id)
        .is("newsletter_sent_at", null)
        .select("*")
        .single();

      if (claimError || !claimedRow) {
        results.push({ id: request.id, title: request.title, result: "skipped", reason: "already sent" });
        continue;
      }

      const claimed = normalizeContentRequestRow(claimedRow as RawContentRequestRow);
      const newsletter = claimed.channel_variants?.newsletter;

      if (!newsletter || !newsletter.body_markdown?.trim()) {
        throw new Error("No newsletter content on this request.");
      }

      await sendNewsletterEmail(newsletter, claimed.title);

      // Success: newsletter_sent_at is already set from the claim above — just clear the schedule.
      await supabaseAdmin.from("content_requests").update({ scheduled_send_at: null }).eq("id", request.id);
      results.push({ id: request.id, title: claimed.title, result: "sent" });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      // Roll back the claim so this retries next poll — leave scheduled_send_at untouched.
      await supabaseAdmin.from("content_requests").update({ newsletter_sent_at: null }).eq("id", request.id);
      console.error(`[cron:send-scheduled-newsletters] failed for ${request.id}:`, reason);
      results.push({ id: request.id, title: request.title, result: "failed", reason });
    }
  }

  return NextResponse.json({
    checked_at: nowIso,
    due_count: dueRows?.length ?? 0,
    sent: results.filter((r) => r.result === "sent").length,
    skipped: results.filter((r) => r.result === "skipped").length,
    failed: results.filter((r) => r.result === "failed").length,
    results,
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
