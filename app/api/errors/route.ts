import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isRole } from "@/lib/role";

const VALID_SOURCES = ["window_error", "unhandled_rejection", "react_error_boundary", "action_failed"];

function safeBoundedContext(value: unknown): object | null {
  if (!value || typeof value !== "object") return null;
  try {
    const json = JSON.stringify(value);
    return json.length <= 4000 ? (value as object) : { truncated: true, preview: json.slice(0, 500) };
  } catch {
    return null;
  }
}

// Frontend error reporting sink — written by lib/log-client-error.ts, read by
// app/dashboard/errors/page.tsx. Deliberately un-gated by role (a crash can happen before a
// role is even chosen, e.g. on /login) and tolerant of bad input, since a broken error report
// is still better dropped quietly than thrown back at whatever just failed.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const source = typeof b?.source === "string" && VALID_SOURCES.includes(b.source) ? b.source : "action_failed";
  const message = typeof b?.message === "string" && b.message.trim() ? b.message.trim().slice(0, 2000) : null;

  if (!message) {
    return NextResponse.json({ error: "message is required." }, { status: 400 });
  }

  const stack = typeof b?.stack === "string" ? b.stack.slice(0, 8000) : null;
  const url = typeof b?.url === "string" ? b.url.slice(0, 1000) : null;
  const role = isRole(b?.role) ? b.role : null;
  const context = safeBoundedContext(b?.context);

  try {
    const { error } = await getSupabaseAdmin()
      .from("client_errors")
      .insert({ source, message, stack, url, role, context });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/errors] failed to store client error:", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
