import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  normalizeContentRequestRow,
  type Channel,
  type ChannelVariants,
  type RawContentRequestRow,
  type RevisionHistoryEntry,
} from "@/lib/content-request";
import { getRoleFromHeaders } from "@/lib/role";
import { callClaudeForJson, ANTHROPIC_SONNET_MODEL, ANTHROPIC_HAIKU_MODEL } from "@/lib/anthropic";
import { evaluateArticleRubric, mergeRubricResult } from "@/lib/rubric-evaluation";
import { SUBSCORE_KEYS, SUBSCORE_LABELS, type SubscoreKey } from "@/lib/rubric";

type ChannelKey = "linkedin" | "twitter_thread" | "newsletter" | "quote_cards";

const CHANNEL_LABELS: Record<ChannelKey, string> = {
  linkedin: "LinkedIn",
  twitter_thread: "X/Twitter thread",
  newsletter: "Newsletter",
  quote_cards: "Quote Cards",
};

const CHANNEL_OUTPUT_SHAPES: Record<ChannelKey, string> = {
  linkedin: `{ "post_text": string }`,
  twitter_thread: `{ "twitter_thread": string[] }`,
  newsletter: `{ "subject_line": string, "preview_text": string, "body_markdown": string }`,
  quote_cards: `{ "quote_cards": string[] }`,
};

// channel_targets (chosen at request creation) uses "x" for Twitter; channel_variants /
// channel_fit key the actual generated content as "twitter_thread". Only these three are
// ever user-targeted — quote_cards is an always-optional bonus derivative, never something
// deep-revise should generate from nothing, only patch if it exists and is flagged.
const TARGET_TO_VARIANT_KEY: Partial<Record<Channel, ChannelKey>> = {
  linkedin: "linkedin",
  x: "twitter_thread",
  newsletter: "newsletter",
};

interface ArticleRevisionResult {
  title: string;
  meta_description: string;
  article_markdown: string;
}

function isArticleRevisionResult(value: unknown): value is ArticleRevisionResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<ArticleRevisionResult>;
  return typeof v.title === "string" && typeof v.meta_description === "string" && typeof v.article_markdown === "string";
}

function hasChannelContent(channelVariants: ChannelVariants | null | undefined, key: ChannelKey): boolean {
  const value = channelVariants?.[key];
  if (!value) return false;
  return Array.isArray(value) ? value.length > 0 : true;
}

function isValidChannelContent(channel: ChannelKey, value: unknown): boolean {
  const v = value as Record<string, unknown> | null;
  if (channel === "linkedin") return typeof v?.post_text === "string";
  if (channel === "twitter_thread") return Array.isArray(v?.twitter_thread);
  if (channel === "newsletter") {
    return typeof v?.subject_line === "string" && typeof v?.preview_text === "string" && typeof v?.body_markdown === "string";
  }
  return Array.isArray(v?.quote_cards);
}

// Extracts just the channel's own value out of the model's wrapper shape, in the exact
// form that belongs directly at channel_variants[channel].
function extractChannelValue(channel: ChannelKey, parsed: unknown): unknown {
  const v = parsed as Record<string, unknown>;
  if (channel === "linkedin") return { post_text: v.post_text };
  if (channel === "twitter_thread") return v.twitter_thread;
  if (channel === "newsletter") return { subject_line: v.subject_line, preview_text: v.preview_text, body_markdown: v.body_markdown };
  return v.quote_cards;
}

async function reviseArticle(input: {
  title: string;
  topic?: string;
  target_audience?: string;
  article_draft: string;
  weakCriteria: { key: SubscoreKey; score: number }[];
  critique?: string;
  weak_sections: string[];
  recommended_changes: string[];
}): Promise<ArticleRevisionResult> {
  const criteriaList = input.weakCriteria.map((c) => `- ${SUBSCORE_LABELS[c.key]}: ${c.score.toFixed(1)}/10`).join("\n");

  const prompt = `You are making a targeted, surgical revision to an article draft. This is NOT a rewrite — you must preserve everything that already works well.

ARTICLE TITLE: ${input.title}
TOPIC: ${input.topic ?? "(not specified)"}
TARGET AUDIENCE: ${input.target_audience ?? "(not specified)"}

CURRENT ARTICLE DRAFT:
"""
${input.article_draft}
"""

QUALITY ASSESSMENT — the following criteria scored BELOW the 7/10 quality bar and need improvement. Every other criterion already scores 7 or above and must not be touched:
${criteriaList}
${input.critique ? `\nEvaluator's critique:\n${input.critique}` : ""}
${input.weak_sections.length > 0 ? `\nSections flagged as weak:\n${input.weak_sections.map((s) => `- ${s}`).join("\n")}` : ""}
${input.recommended_changes.length > 0 ? `\nRecommended changes:\n${input.recommended_changes.map((c) => `- ${c}`).join("\n")}` : ""}

INSTRUCTIONS: Only revise the specific issues described above, addressing the low-scoring criteria. Copy every other paragraph verbatim from the original draft. Do not rewrite sections that were not flagged. This is a targeted patch, not a rewrite.

Respond with ONLY strict JSON, no other text, in this exact shape:
{"title": string, "meta_description": string, "article_markdown": string}`;

  const parsed = await callClaudeForJson(prompt, 8000, ANTHROPIC_SONNET_MODEL);
  if (!isArticleRevisionResult(parsed)) {
    throw new Error("Article revision response was missing required fields.");
  }
  return parsed;
}

// Generic per-channel patch: sends whatever the channel's current content is (object or
// array) as JSON and asks for the same shape back, patched to address the violations only.
async function patchChannelContent(channel: ChannelKey, currentContent: unknown, violations: string[]): Promise<unknown> {
  const isArray = Array.isArray(currentContent);
  const prompt = `You are making a targeted, surgical revision to a piece of ${CHANNEL_LABELS[channel]} content. This is NOT a rewrite.

CURRENT CONTENT (JSON):
${JSON.stringify(currentContent)}

The following issues were flagged and must be fixed:
${violations.map((v) => `- ${v}`).join("\n")}

Everything else in this content is fine and must be preserved as closely as possible — only change what's needed to address the violations above.

Respond with ONLY the corrected content as JSON, in the exact same shape as CURRENT CONTENT above (${isArray ? "a JSON array" : "a JSON object"}), no other text. Wrap it as {"result": <the corrected content>} so it's valid to parse as a JSON object.`;

  const parsed = await callClaudeForJson(prompt, 2000, ANTHROPIC_HAIKU_MODEL);
  const result = (parsed as { result?: unknown })?.result;

  if (isArray && !Array.isArray(result)) {
    throw new Error(`Expected an array back for ${channel}, got something else.`);
  }
  if (!isArray && (typeof result !== "object" || result === null || Array.isArray(result))) {
    throw new Error(`Expected an object back for ${channel}, got something else.`);
  }
  return result;
}

// This channel was targeted at request creation but never generated (or is currently
// empty) — create it from scratch using the (possibly just-revised) article as context.
async function generateChannelContent(channel: ChannelKey, title: string, articleMarkdown: string): Promise<unknown> {
  const prompt = `You are creating ${CHANNEL_LABELS[channel]} content to accompany an article, as part of a multi-channel content package. This channel currently has no content yet — generate it from scratch based on the article below, following the typical conventions, tone, and length for this channel.

ARTICLE TITLE: ${title}

ARTICLE (for context — adapt it for this channel, don't just copy it):
"""
${articleMarkdown}
"""

Respond with ONLY strict JSON, no other text, in this exact shape: ${CHANNEL_OUTPUT_SHAPES[channel]}`;

  const parsed = await callClaudeForJson(prompt, 2000, ANTHROPIC_HAIKU_MODEL);
  if (!isValidChannelContent(channel, parsed)) {
    throw new Error(`Generated ${channel} content was missing required fields.`);
  }
  return extractChannelValue(channel, parsed);
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/content-requests/[id]/deep-revise">) {
  const { id } = await ctx.params;
  const role = getRoleFromHeaders(req.headers);
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error: fetchError } = await supabaseAdmin.from("content_requests").select("*").eq("id", id).single();
  if (fetchError || !data) {
    return NextResponse.json({ error: "Content request not found." }, { status: 404 });
  }

  const request = normalizeContentRequestRow(data as RawContentRequestRow);

  // Never trust the client alone: this mirrors the same lock check every other mutation
  // route applies once a newsletter has gone out.
  if (request.newsletter_sent_at) {
    return NextResponse.json(
      { error: "This request is locked — its newsletter has already been sent." },
      { status: 409 },
    );
  }

  const scores = request.evaluation_report?.scores;
  const weakCriteria = scores
    ? SUBSCORE_KEYS.filter((key) => typeof scores[key] === "number" && (scores[key] as number) < 7).map((key) => ({
        key,
        score: scores[key] as number,
      }))
    : [];

  const channelFit = request.evaluation_report?.channel_fit;

  // Every targeted channel that's completely missing gets generated from scratch; every
  // targeted (or quote_cards) channel that exists but is explicitly flagged gets patched.
  const generateChannels: ChannelKey[] = [];
  const patchChannels: ChannelKey[] = [];

  for (const target of request.channel_targets ?? []) {
    const key = TARGET_TO_VARIANT_KEY[target];
    if (!key) continue;
    if (!hasChannelContent(request.channel_variants, key)) {
      generateChannels.push(key);
    } else if (channelFit?.[key]?.passes_checklist === false) {
      patchChannels.push(key);
    }
  }
  if (hasChannelContent(request.channel_variants, "quote_cards") && channelFit?.quote_cards?.passes_checklist === false) {
    patchChannels.push("quote_cards");
  }

  if (weakCriteria.length === 0 && generateChannels.length === 0 && patchChannels.length === 0) {
    return NextResponse.json(
      {
        error:
          "This draft already meets the quality bar across all criteria, and all channel content looks good — no automatic revision needed.",
      },
      { status: 400 },
    );
  }

  try {
    // Article revision and channel patching are independent of each other — run them
    // together. Channel generation needs the (possibly revised) article as context, so it
    // waits for the article step; re-evaluation does too, and neither depends on the other.
    const [articleResult, patchResults] = await Promise.all([
      weakCriteria.length > 0
        ? reviseArticle({
            title: request.title,
            topic: request.topic,
            target_audience: request.target_audience,
            article_draft: request.article_draft,
            weakCriteria,
            critique: request.evaluation_report?.critique,
            weak_sections: request.evaluation_report?.weak_sections ?? [],
            recommended_changes: request.evaluation_report?.recommended_changes ?? [],
          })
        : Promise.resolve(null),
      Promise.all(
        patchChannels.map(async (channel) => {
          const currentContent = request.channel_variants?.[channel];
          const violations = channelFit?.[channel]?.violations ?? [];
          try {
            const value = await patchChannelContent(channel, currentContent, violations);
            return { channel, value };
          } catch (err) {
            console.log(`[deep-revise] channel patch failed for "${channel}":`, err instanceof Error ? err.message : err);
            return null;
          }
        }),
      ),
    ]);

    const finalTitle = articleResult?.title ?? request.title;
    const finalMetaDescription = articleResult?.meta_description ?? request.meta_description;
    const finalArticleMarkdown = articleResult?.article_markdown ?? request.article_draft;

    const [generateResults, freshEvaluation] = await Promise.all([
      Promise.all(
        generateChannels.map(async (channel) => {
          try {
            const value = await generateChannelContent(channel, finalTitle, finalArticleMarkdown);
            return { channel, value };
          } catch (err) {
            console.log(`[deep-revise] channel generation failed for "${channel}":`, err instanceof Error ? err.message : err);
            return null;
          }
        }),
      ),
      weakCriteria.length > 0
        ? evaluateArticleRubric({
            title: finalTitle,
            topic: request.topic,
            target_audience: request.target_audience,
            article_markdown: finalArticleMarkdown,
            sources: request.sources,
          })
        : Promise.resolve(null),
    ]);

    const actuallyPatched = patchResults.filter((r): r is { channel: ChannelKey; value: unknown } => !!r);
    const actuallyGenerated = generateResults.filter((r): r is { channel: ChannelKey; value: unknown } => !!r);

    const noteParts: string[] = [];
    if (articleResult) noteParts.push(`targeted criteria: ${weakCriteria.map((c) => SUBSCORE_LABELS[c.key]).join(", ")}`);
    if (actuallyGenerated.length > 0) {
      noteParts.push(`generated channel content: ${actuallyGenerated.map((r) => CHANNEL_LABELS[r.channel]).join(", ")}`);
    }
    if (actuallyPatched.length > 0) {
      noteParts.push(`patched channel content: ${actuallyPatched.map((r) => CHANNEL_LABELS[r.channel]).join(", ")}`);
    }

    if (noteParts.length === 0) {
      // There was work to attempt (the gate above passed), but every single attempt failed.
      return NextResponse.json(
        { error: "Could not complete any part of this revision — every attempted change failed. Nothing was saved." },
        { status: 502 },
      );
    }

    const updatedChannelVariants: ChannelVariants = { ...(request.channel_variants ?? {}) };
    for (const result of [...actuallyPatched, ...actuallyGenerated]) {
      (updatedChannelVariants as Record<ChannelKey, unknown>)[result.channel] = result.value;
    }

    const updatePayload: Record<string, unknown> = { channel_variants: updatedChannelVariants };
    if (articleResult) {
      updatePayload.title = finalTitle;
      updatePayload.meta_description = finalMetaDescription;
      updatePayload.article_draft = finalArticleMarkdown;
    }
    if (freshEvaluation) {
      updatePayload.evaluation_report = mergeRubricResult(request.evaluation_report, freshEvaluation);
      updatePayload.evaluation_score = freshEvaluation.overall_score;
    }

    const newRevisionEntry: RevisionHistoryEntry = {
      revision_number: (request.revision_history?.length ?? 0) + 1,
      timestamp: new Date().toISOString(),
      triggered_by: role,
      reviewer_notes: `Automatic full revision — ${noteParts.join("; ")}`,
      score_before: freshEvaluation ? request.evaluation_score : null,
      score_after: freshEvaluation ? freshEvaluation.overall_score : null,
      approval_status_after: freshEvaluation ? freshEvaluation.approval_status : null,
    };
    updatePayload.revision_history = [...(request.revision_history ?? []), newRevisionEntry];

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("content_requests")
      .update(updatePayload)
      .eq("id", id)
      .is("newsletter_sent_at", null)
      .select("*")
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: "Could not save the revised content — this request may have been locked in the meantime." },
        { status: 409 },
      );
    }

    return NextResponse.json(normalizeContentRequestRow(updated as RawContentRequestRow));
  } catch (err) {
    // Nothing is written until the final save succeeds, so a failure anywhere above leaves
    // the row completely untouched — safe to just report the error.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not complete the full revision." },
      { status: 502 },
    );
  }
}
