import { NextRequest, NextResponse } from "next/server";
import { callClaudeForJson } from "@/lib/anthropic";

// A lightweight, advisory check — not a gate on the revision itself (that stays in
// /revise and /flag-for-revision). Called before a Request Revision submission so a
// reviewer can catch "make it better"-style notes before they reach the writer/pipeline.
interface CheckResult {
  specific: boolean;
  suggestion: string | null;
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/content-requests/[id]/check-revision-specificity">) {
  await ctx.params; // id isn't needed by the check itself — kept for route-shape consistency with its sibling routes.

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
    return NextResponse.json({ error: "reviewer_notes is required." }, { status: 400 });
  }

  const prompt = `You are reviewing a revision note a content reviewer is about to send to a content editor/writer, asking them to rework a draft.

Determine whether the note gives specific, actionable direction the writer could actually act on, or whether it's too vague to be useful (e.g. "make it better", "increase the score", "fix it", "needs work", "not good enough").

Reviewer's note:
"""
${reviewerNotes}
"""

Respond with ONLY strict JSON, no other text, in this exact shape:
{"specific": boolean, "suggestion": string | null}

- "specific": true if the note names what's wrong or what to change (a section, a fact, a tone issue, a structural problem, anything concrete) — even a short note can be specific if it's concrete. false if it's generic praise/criticism with no actionable substance.
- "suggestion": if specific is false, one brief sentence suggesting what kind of detail would make it actionable. If specific is true, null.`;

  let parsed: unknown;
  try {
    parsed = await callClaudeForJson(prompt, 300);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not check this note with the Anthropic API." },
      { status: 502 },
    );
  }

  const result = parsed as Partial<CheckResult>;
  if (typeof result.specific !== "boolean") {
    return NextResponse.json({ error: "Model response was missing the expected 'specific' field." }, { status: 502 });
  }

  return NextResponse.json({
    specific: result.specific,
    suggestion: typeof result.suggestion === "string" ? result.suggestion : null,
  } satisfies CheckResult);
}
