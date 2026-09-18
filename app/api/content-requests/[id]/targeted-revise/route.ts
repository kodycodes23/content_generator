import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  normalizeContentRequestRow,
  REVISION_TARGETS,
  type ChannelVariants,
  type ContentRequest,
  type RawContentRequestRow,
  type RevisionHistoryEntry,
  type RevisionTarget,
} from "@/lib/content-request";
import { getRoleFromHeaders } from "@/lib/role";
import { callClaudeForJson, ANTHROPIC_SONNET_MODEL, ANTHROPIC_HAIKU_MODEL } from "@/lib/anthropic";
import { summarizeDiff } from "@/lib/diff";

// A note under this many words counts as "narrow" for the guardrail — a short, specific
// instruction that shouldn't plausibly justify a large rewrite.
const NARROW_NOTE_WORD_LIMIT = 20;
// Above this proportion of words changed, a narrow note's result is treated as suspicious.
const SUSPICIOUS_CHANGE_RATIO = 0.3;

function buildPrompt(target: RevisionTarget, note: string, content: unknown): string {
  const outputShape =
    target === "article"
      ? `{ "title": string, "meta_description": string, "article_markdown": string }`
      : target === "linkedin"
        ? `{ "post_text": string }`
        : target === "twitter"
          ? `{ "twitter_thread": string[] }`
          : target === "newsletter"
            ? `{ "subject_line": string, "preview_text": string, "body_markdown": string }`
            : `{ "quote_cards": string[] }`;

  return `You are making a SURGICAL, MINIMAL edit to ONLY the following content. You are NOT rewriting or improving anything beyond exactly what is requested.

TARGETED CHANGE REQUESTED: "${note}"

RULES — FOLLOW EXACTLY:
1. Identify ONLY the specific word(s), sentence(s), or section the request refers to.
2. Make ONLY that exact change. Do not rephrase, restructure, improve, or "clean up" anything else — including things you personally think could be better, even typos or awkward phrasing you notice elsewhere.
3. Every part of the content outside the targeted change must be character-for-character identical to the original.
4. If the request is ambiguous about scope, make the most conservative, minimal interpretation possible — change the fewest characters that satisfy the request.
5. Return the FULL content (the complete article, or the complete channel content) with only that one change applied — not just a snippet or excerpt.

CONTENT TO EDIT:
${JSON.stringify(content)}

Output strictly valid JSON with no markdown code blocks, matching the same shape as the original field: ${outputShape}`;
}

// Everything the route needs to know to handle one target, in one place — reading/
// validating Claude's response, building the exact Supabase update payload, and rendering
// old/new as plain text for the diff guardrail.
interface TargetPlan {
  model: string;
  currentContent: unknown;
  missingMessage: string | null; // set (and returned as a 400) if there's nothing to edit yet
  validate: (value: unknown) => boolean;
  diffText: (value: unknown) => string;
  buildUpdate: (value: unknown) => Record<string, unknown>;
}

function planForTarget(target: RevisionTarget, request: ContentRequest): TargetPlan {
  if (target === "article") {
    return {
      model: ANTHROPIC_SONNET_MODEL,
      currentContent: { title: request.title, meta_description: request.meta_description, article_markdown: request.article_draft },
      missingMessage: request.article_draft.trim() ? null : "This request has no article draft yet to edit.",
      validate: (v) => {
        const r = v as Partial<{ title: unknown; meta_description: unknown; article_markdown: unknown }>;
        return typeof r.title === "string" && typeof r.meta_description === "string" && typeof r.article_markdown === "string";
      },
      diffText: (v) => {
        const r = v as { title: string; meta_description: string; article_markdown: string };
        return `${r.title}\n\n${r.meta_description}\n\n${r.article_markdown}`;
      },
      buildUpdate: (v) => {
        const r = v as { title: string; meta_description: string; article_markdown: string };
        return { title: r.title, meta_description: r.meta_description, article_draft: r.article_markdown };
      },
    };
  }

  if (target === "linkedin") {
    const current = request.channel_variants?.linkedin;
    return {
      model: ANTHROPIC_HAIKU_MODEL,
      currentContent: current ?? null,
      missingMessage: current ? null : "No LinkedIn content exists for this request yet to edit.",
      validate: (v) => typeof (v as { post_text?: unknown })?.post_text === "string",
      diffText: (v) => (v as { post_text: string }).post_text,
      buildUpdate: (v) => ({
        channel_variants: { ...(request.channel_variants ?? {}), linkedin: { post_text: (v as { post_text: string }).post_text } },
      }),
    };
  }

  if (target === "twitter") {
    const current = request.channel_variants?.twitter_thread;
    return {
      model: ANTHROPIC_HAIKU_MODEL,
      currentContent: current ?? null,
      missingMessage: current && current.length > 0 ? null : "No X/Twitter thread exists for this request yet to edit.",
      validate: (v) => Array.isArray((v as { twitter_thread?: unknown })?.twitter_thread),
      diffText: (v) => (v as { twitter_thread: string[] }).twitter_thread.join("\n\n"),
      buildUpdate: (v) => ({
        channel_variants: { ...(request.channel_variants ?? {}), twitter_thread: (v as { twitter_thread: string[] }).twitter_thread },
      }),
    };
  }

  if (target === "newsletter") {
    const current = request.channel_variants?.newsletter;
    return {
      model: ANTHROPIC_HAIKU_MODEL,
      currentContent: current ?? null,
      missingMessage: current ? null : "No newsletter content exists for this request yet to edit.",
      validate: (v) => {
        const r = v as Partial<{ subject_line: unknown; preview_text: unknown; body_markdown: unknown }>;
        return typeof r.subject_line === "string" && typeof r.preview_text === "string" && typeof r.body_markdown === "string";
      },
      diffText: (v) => {
        const r = v as { subject_line: string; preview_text: string; body_markdown: string };
        return `${r.subject_line}\n\n${r.preview_text}\n\n${r.body_markdown}`;
      },
      buildUpdate: (v) => ({ channel_variants: { ...(request.channel_variants ?? {}), newsletter: v } }),
    };
  }

  // quote_cards
  const current = request.channel_variants?.quote_cards;
  return {
    model: ANTHROPIC_HAIKU_MODEL,
    currentContent: current ?? null,
    missingMessage: current && current.length > 0 ? null : "No quote cards exist for this request yet to edit.",
    validate: (v) => Array.isArray((v as { quote_cards?: unknown })?.quote_cards),
    diffText: (v) => (v as { quote_cards: string[] }).quote_cards.join("\n\n"),
    buildUpdate: (v) => ({
      channel_variants: { ...(request.channel_variants ?? {}), quote_cards: (v as { quote_cards: string[] }).quote_cards },
    }),
  };
}

// Explicit internal-invariant check: everything the update payload touches outside the
// targeted field must be byte-identical to what was there before the AI call. This can only
// fail from a coding bug (Claude was never shown the other fields, so it can't have changed
// them) — if it ever does, treat it as a serious internal error rather than saving anything.
function assertOnlyTargetChanged(target: RevisionTarget, before: ChannelVariants | null | undefined, update: Record<string, unknown>) {
  if (target === "article") return; // update payload only ever contains title/meta_description/article_draft
  const updatedVariants = update.channel_variants as ChannelVariants;
  const otherKeys = (["linkedin", "twitter_thread", "newsletter", "quote_cards"] as const).filter((k) => k !== target);
  for (const key of otherKeys) {
    if (JSON.stringify(before?.[key]) !== JSON.stringify(updatedVariants[key])) {
      throw new Error(`INTERNAL GUARDRAIL FAILURE: channel_variants.${key} changed unexpectedly during a targeted revision of "${target}".`);
    }
  }
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/content-requests/[id]/targeted-revise">) {
  const { id } = await ctx.params;
  const role = getRoleFromHeaders(req.headers);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const target = (body as { target?: unknown })?.target;
  const note = typeof (body as { note?: unknown })?.note === "string" ? (body as { note: string }).note.trim() : "";

  if (typeof target !== "string" || !REVISION_TARGETS.includes(target as RevisionTarget)) {
    return NextResponse.json({ error: `target must be one of: ${REVISION_TARGETS.join(", ")}.` }, { status: 400 });
  }
  if (note.length < 5) {
    return NextResponse.json({ error: "note is required." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data, error: fetchError } = await supabaseAdmin.from("content_requests").select("*").eq("id", id).single();
  if (fetchError || !data) {
    return NextResponse.json({ error: "Content request not found." }, { status: 404 });
  }

  const request = normalizeContentRequestRow(data as RawContentRequestRow);

  // Never trust the client alone: mirrors the same lock check every other mutation route
  // applies once a newsletter has gone out.
  if (request.newsletter_sent_at) {
    return NextResponse.json({ error: "This request is locked — its newsletter has already been sent." }, { status: 409 });
  }

  const plan = planForTarget(target as RevisionTarget, request);
  if (plan.missingMessage) {
    return NextResponse.json({ error: plan.missingMessage }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = await callClaudeForJson(buildPrompt(target as RevisionTarget, note, plan.currentContent), 8000, plan.model);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not complete the targeted revision." },
      { status: 502 },
    );
  }

  if (!plan.validate(parsed)) {
    return NextResponse.json({ error: "The model's response was missing required fields for this target." }, { status: 502 });
  }

  const update = plan.buildUpdate(parsed);

  // Guardrail (a): confirm nothing outside the target moved.
  try {
    assertOnlyTargetChanged(target as RevisionTarget, request.channel_variants, update);
  } catch (err) {
    console.error("[targeted-revise]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal error: the revision touched more than it should have. Nothing was saved." }, { status: 500 });
  }

  // Guardrail (b): a narrow note that produced a disproportionately large diff is suspicious.
  const oldText = plan.diffText(plan.currentContent);
  const newText = plan.diffText(parsed);
  const { parts: diffParts, changeRatio } = summarizeDiff(oldText, newText);
  const noteIsNarrow = note.split(/\s+/).filter(Boolean).length < NARROW_NOTE_WORD_LIMIT;

  if (noteIsNarrow && changeRatio > SUSPICIOUS_CHANGE_RATIO) {
    console.log(
      `[targeted-revise] rejected: request ${id}, target "${target}", note "${note}" — changeRatio=${changeRatio.toFixed(2)}, diff=`,
      JSON.stringify(diffParts),
    );
    return NextResponse.json(
      {
        error:
          "This revision changed significantly more than requested. Nothing was saved — try again with a more specific instruction, or use Full Revision instead.",
      },
      { status: 422 },
    );
  }

  const newRevisionEntry: RevisionHistoryEntry = {
    revision_number: (request.revision_history?.length ?? 0) + 1,
    timestamp: new Date().toISOString(),
    triggered_by: role,
    reviewer_notes: note,
    target: target as RevisionTarget,
    diff_summary: JSON.stringify(diffParts),
    score_before: null,
    score_after: null,
    approval_status_after: null,
  };

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("content_requests")
    .update({ ...update, revision_history: [...(request.revision_history ?? []), newRevisionEntry] })
    .eq("id", id)
    .is("newsletter_sent_at", null)
    .select("*")
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: "Could not save the revision — this request may have been locked in the meantime." },
      { status: 409 },
    );
  }

  return NextResponse.json(normalizeContentRequestRow(updated as RawContentRequestRow));
}
