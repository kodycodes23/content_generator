// Single source of truth for the 8-criterion rubric's keys/labels — no "server-only" here
// since both client UI (EvaluationPanel, ActionBar) and server code (rubric-evaluation.ts,
// deep-revise) need these without pulling in the Anthropic-calling logic.
export const SUBSCORE_KEYS = [
  "topic_relevance",
  "grounding",
  "factual_consistency",
  "audience_fit",
  "tone",
  "seo_fit",
  "clarity",
  "completeness",
] as const;

export type SubscoreKey = (typeof SUBSCORE_KEYS)[number];

export const SUBSCORE_LABELS: Record<SubscoreKey, string> = {
  topic_relevance: "Topic Relevance",
  grounding: "Source Grounding",
  factual_consistency: "Factual Consistency",
  audience_fit: "Audience Fit",
  tone: "Tone",
  seo_fit: "SEO Fit",
  clarity: "Clarity",
  completeness: "Completeness",
};

export interface RubricEvaluationResult {
  approval_status: "pass" | "revise" | "reject";
  overall_score: number;
  grounding_pass: boolean;
  scores: Record<SubscoreKey, number>;
  critique: string;
  weak_sections: string[];
  recommended_changes: string[];
}
