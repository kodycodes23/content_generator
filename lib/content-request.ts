// Shared types for the real Supabase `content_requests` table, plus the normalizer that
// fills in safe defaults for not-yet-generated columns. Used by every page/component that
// reads or writes this table: the Overview table and the /dashboard/[id]/review workspace.

export type Channel = "linkedin" | "x" | "newsletter";

export interface ChannelVariants {
  linkedin?: {
    post_text: string;
  };
  twitter_thread?: string[];
  newsletter?: {
    subject_line: string;
    preview_text: string;
    body_markdown: string;
  };
  quote_cards?: string[];
}

export interface ContentRequestSource {
  fact: string;
  source_url: string;
  source_title: string;
}

export interface InternalLink {
  title: string;
  url: string;
}

export interface ResearchedKeywords {
  short_tail: string[];
  long_tail: string[];
}

export type RevisionTarget = "article" | "linkedin" | "twitter" | "newsletter" | "quote_cards";

export const REVISION_TARGETS: RevisionTarget[] = ["article", "linkedin", "twitter", "newsletter", "quote_cards"];

export const REVISION_TARGET_LABELS: Record<RevisionTarget, string> = {
  article: "Article",
  linkedin: "LinkedIn post",
  twitter: "X/Twitter thread",
  newsletter: "Newsletter",
  quote_cards: "Quote Cards",
};

// A single diff-part, matching the shape the `diff` package's diffWords() returns
// (trimmed down to compact context) — used to render a highlighted before/after in the UI.
export interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface RevisionHistoryEntry {
  revision_number: number;
  timestamp: string;
  triggered_by: "content_writer" | "manager";
  reviewer_notes: string;
  // null for a targeted single-field edit — that path doesn't run a full rubric
  // re-evaluation, unlike deep-revise (which always provides real numbers/a real status).
  score_before: number | null;
  score_after: number | null;
  approval_status_after: "pass" | "revise" | "reject" | null;
  // Only present on targeted-revise entries — which field was edited, and a compact
  // before/after diff (JSON-encoded DiffPart[]) for the revision history UI to highlight.
  target?: RevisionTarget;
  diff_summary?: string;
}

export type ContentRequestStatus =
  | "researching"
  | "pending_human_review"
  | "submitted_for_approval"
  | "revision_requested"
  | "approved"
  | "rejected"
  | "published";

export interface ChannelFitEntry {
  passes_checklist: boolean;
  violations: string[];
}

// Every field here (and every nested field) is optional on purpose: real rows have shown
// up with this column set to `{}`, missing individual fields, or an older/shorter shape
// than what the pipeline writes today — nothing downstream may assume a field is present
// just because evaluation_report itself is truthy.
export interface EvaluationReportDetail {
  approval_status?: "pass" | "revise" | "reject" | string;
  overall_score?: number;
  grounding_pass?: boolean;
  scores?: {
    topic_relevance?: number;
    grounding?: number;
    factual_consistency?: number;
    audience_fit?: number;
    tone?: number;
    seo_fit?: number;
    clarity?: number;
    completeness?: number;
  };
  critique?: string;
  weak_sections?: string[];
  recommended_changes?: string[];
  exit_reason?: "passed_evaluation" | "max_iterations_reached" | "human_revision" | string;
  iterations_used?: number;
  channel_fit?: {
    linkedin?: ChannelFitEntry;
    twitter_thread?: ChannelFitEntry;
    newsletter?: ChannelFitEntry;
    quote_cards?: ChannelFitEntry;
    overall_channel_fit_pass?: boolean;
  };
}

export interface ContentRequest {
  id: string;
  created_at?: string;
  updated_at?: string;
  topic?: string;
  target_audience?: string;
  source_url?: string | null;
  attachment_url?: string | null;
  channel_targets?: Channel[];
  primary_keywords?: string[];
  title: string;
  meta_description: string;
  article_draft: string;
  featured_image_url?: string | null;
  internal_links?: InternalLink[];
  researched_keywords?: ResearchedKeywords;
  channel_variants: ChannelVariants | null;
  evaluation_score: number;
  evaluation_report?: EvaluationReportDetail | null;
  status: ContentRequestStatus;
  error_message?: string | null;
  reviewer_notes?: string | null;
  newsletter_sent_at?: string | null;
  scheduled_send_at?: string | null;
  revision_history?: RevisionHistoryEntry[];
  sources: ContentRequestSource[];
}

// Shape of a raw row exactly as it comes back from Supabase. Most generated-output
// columns are nullable in the DB because a row starts out with only the original
// request fields (topic, target_audience, ...) — the rest gets filled in later by n8n.
export interface RawContentRequestRow {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
  topic?: string | null;
  target_audience?: string | null;
  source_url?: string | null;
  attachment_url?: string | null;
  channel_targets?: Channel[] | null;
  primary_keywords?: string[] | null;
  title?: string | null;
  meta_description?: string | null;
  article_draft?: string | null;
  featured_image_url?: string | null;
  internal_links?: InternalLink[] | null;
  researched_keywords?: ResearchedKeywords | null;
  channel_variants?: ChannelVariants | null;
  sources?: ContentRequestSource[] | null;
  evaluation_report?: EvaluationReportDetail | null;
  evaluation_score?: number | null;
  status: ContentRequestStatus;
  error_message?: string | null;
  reviewer_notes?: string | null;
  newsletter_sent_at?: string | null;
  scheduled_send_at?: string | null;
  revision_history?: RevisionHistoryEntry[] | null;
}

// Some upstream writers (n8n included) JSON.stringify() a value before writing it into a
// jsonb column, so PostgREST hands it back as a plain string instead of the parsed
// object/array it should be — sometimes more than once (a string containing a string
// containing the real value). Unwrap repeatedly (bounded, so pathological input can't loop
// forever) until it's no longer a string. Defend against this everywhere a jsonb column is read.
function parseMaybeJson<T>(value: unknown, fallback: T): T {
  let current: unknown = value;
  for (let i = 0; i < 5 && typeof current === "string"; i++) {
    try {
      current = JSON.parse(current);
    } catch {
      return fallback;
    }
  }
  return current === null || current === undefined ? fallback : (current as T);
}

// For jsonb columns that must end up as an array (or the given fallback, e.g. undefined for
// an optional field) — falls back rather than handing a caller something a stray .map()
// would crash on if parsing above still didn't yield a real array.
function parseMaybeJsonArray<T, F>(value: unknown, fallback: F): T[] | F {
  const parsed = parseMaybeJson<unknown>(value, fallback);
  return Array.isArray(parsed) ? (parsed as T[]) : fallback;
}

// channel_variants parses fine as an object even when one of its own array fields is the
// malformed (stringified) value described above — guard those nested arrays too, the same
// way parseMaybeJsonArray guards a top-level column, so ChannelPreview's .map() calls can't
// hit the same crash one level deeper.
function sanitizeChannelVariants(value: ChannelVariants | null): ChannelVariants | null {
  if (!value) return value;
  return {
    ...value,
    twitter_thread: Array.isArray(value.twitter_thread) ? value.twitter_thread : undefined,
    quote_cards: Array.isArray(value.quote_cards) ? value.quote_cards : undefined,
  };
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Fills in safe defaults for the not-yet-generated columns so callers (ArticleReviewPanel,
// ReviewWorkspace, ...) never see null (or a raw JSON string) where they expect a
// string/array/object.
export function normalizeContentRequestRow(row: RawContentRequestRow): ContentRequest {
  return {
    id: row.id,
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
    topic: row.topic ?? undefined,
    target_audience: row.target_audience ?? undefined,
    source_url: row.source_url ?? null,
    attachment_url: row.attachment_url ?? null,
    channel_targets: parseMaybeJsonArray<Channel, undefined>(row.channel_targets, undefined),
    primary_keywords: parseMaybeJsonArray<string, undefined>(row.primary_keywords, undefined),
    title: row.title?.trim() || row.topic?.trim() || "Untitled request",
    meta_description: row.meta_description ?? "",
    article_draft: row.article_draft ?? "",
    featured_image_url: row.featured_image_url ?? null,
    internal_links: parseMaybeJsonArray<InternalLink, InternalLink[]>(row.internal_links, []),
    researched_keywords: parseMaybeJson<ResearchedKeywords>(row.researched_keywords, { short_tail: [], long_tail: [] }),
    channel_variants: sanitizeChannelVariants(parseMaybeJson<ChannelVariants | null>(row.channel_variants, null)),
    evaluation_score: toFiniteNumber(row.evaluation_score, 0),
    evaluation_report: parseMaybeJson<EvaluationReportDetail | null>(row.evaluation_report, null),
    status: row.status,
    error_message: row.error_message ?? null,
    reviewer_notes: row.reviewer_notes ?? null,
    newsletter_sent_at: row.newsletter_sent_at ?? null,
    scheduled_send_at: row.scheduled_send_at ?? null,
    revision_history: parseMaybeJsonArray<RevisionHistoryEntry, RevisionHistoryEntry[]>(row.revision_history, []),
    sources: parseMaybeJsonArray<ContentRequestSource, ContentRequestSource[]>(row.sources, []),
  };
}
