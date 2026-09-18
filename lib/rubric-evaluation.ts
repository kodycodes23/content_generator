import "server-only";
import { callClaudeForJson, ANTHROPIC_SONNET_MODEL } from "./anthropic";
import { SUBSCORE_KEYS, type RubricEvaluationResult } from "./rubric";
import type { ContentRequestSource, EvaluationReportDetail } from "./content-request";

function isRubricEvaluationResult(value: unknown): value is RubricEvaluationResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<RubricEvaluationResult>;
  if (typeof v.overall_score !== "number" || typeof v.grounding_pass !== "boolean") return false;
  if (!v.scores || typeof v.scores !== "object") return false;
  return SUBSCORE_KEYS.every((key) => typeof (v.scores as Record<string, unknown>)[key] === "number");
}

// The same 8-criterion rubric evaluation used by the n8n pipeline's Claude - Rubric
// Evaluator node — kept in exactly one place so this and anything else that needs a fresh
// evaluation (e.g. deep-revise) stay consistent with each other.
export async function evaluateArticleRubric(input: {
  title: string;
  topic?: string;
  target_audience?: string;
  article_markdown: string;
  sources: ContentRequestSource[];
}): Promise<RubricEvaluationResult> {
  const sourcesText =
    input.sources.length > 0
      ? input.sources.map((s) => `- ${s.fact} (${s.source_title})`).join("\n")
      : "No sources recorded.";

  const prompt = `You are an expert content editor evaluating a draft article against an 8-criterion quality rubric. Score each criterion from 0-10.

ARTICLE TITLE: ${input.title}
TOPIC: ${input.topic ?? "(not specified)"}
TARGET AUDIENCE: ${input.target_audience ?? "(not specified)"}

ARTICLE DRAFT:
"""
${input.article_markdown}
"""

SOURCES USED (for grounding/factual consistency checks):
${sourcesText}

Score the article on these 8 criteria (0-10 each):
1. topic_relevance — how well the content stays focused on and delivers on the stated topic
2. grounding — how well claims are supported by the listed sources, without unsupported assertions
3. factual_consistency — internal consistency; no contradictions or factual errors
4. audience_fit — appropriateness of depth, tone, and framing for the target audience
5. tone — consistency and appropriateness of voice throughout
6. seo_fit — clear structure, scannable headings, natural keyword usage
7. clarity — how easy the writing is to follow; no confusing or convoluted passages
8. completeness — whether the article fully covers what it sets out to cover, no gaps

Respond with ONLY strict JSON, no other text, in this exact shape:
{
  "approval_status": "pass" | "revise" | "reject",
  "overall_score": number,
  "grounding_pass": boolean,
  "scores": {
    "topic_relevance": number, "grounding": number, "factual_consistency": number,
    "audience_fit": number, "tone": number, "seo_fit": number, "clarity": number, "completeness": number
  },
  "critique": string,
  "weak_sections": string[],
  "recommended_changes": string[]
}

- "approval_status": "pass" if overall_score >= 8, "revise" if 5-7.9, "reject" if below 5.
- "overall_score": the average of the 8 criteria scores, rounded to 1 decimal.
- "grounding_pass": true if grounding >= 7.
- "weak_sections": names/excerpts of any specific sections still weak (empty array if none).
- "recommended_changes": specific actionable suggestions for any remaining weak areas (empty array if none).`;

  const parsed = await callClaudeForJson(prompt, 2000, ANTHROPIC_SONNET_MODEL);
  if (!isRubricEvaluationResult(parsed)) {
    throw new Error("Rubric evaluation response was missing required fields.");
  }

  return {
    approval_status: parsed.approval_status,
    overall_score: parsed.overall_score,
    grounding_pass: parsed.grounding_pass,
    scores: parsed.scores,
    critique: typeof parsed.critique === "string" ? parsed.critique : "",
    weak_sections: Array.isArray(parsed.weak_sections) ? parsed.weak_sections : [],
    recommended_changes: Array.isArray(parsed.recommended_changes) ? parsed.recommended_changes : [],
  };
}

// Merges a fresh rubric result into an existing evaluation_report, preserving fields the
// rubric evaluation doesn't produce (channel_fit, exit_reason, iterations_used).
export function mergeRubricResult(
  existing: EvaluationReportDetail | null | undefined,
  fresh: RubricEvaluationResult,
): EvaluationReportDetail {
  return {
    ...existing,
    approval_status: fresh.approval_status,
    overall_score: fresh.overall_score,
    grounding_pass: fresh.grounding_pass,
    scores: fresh.scores,
    critique: fresh.critique,
    weak_sections: fresh.weak_sections,
    recommended_changes: fresh.recommended_changes,
  };
}
