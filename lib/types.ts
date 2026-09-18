export type ContentStatus =
  | "drafting"
  | "pending_review"
  | "approved"
  | "queued"
  | "published"
  | "rejected";

export type Audience = "executive" | "practitioner" | "technical";

export type Channel = "linkedin" | "x" | "newsletter";

export type SourceType = "url" | "text" | "none";

export interface SourceCitation {
  id: string;
  index: number;
  url: string | null;
  title: string;
  excerpt: string;
  usedInSections: string[];
  retrievedAt: string;
}

export interface EvaluationCriterionScore {
  criterion: string;
  score: number;
  notes: string;
}

export type EvaluationStatus = "pass" | "revise" | "reject";

export interface EvaluationReport {
  id: string;
  version: number;
  overallScore: number;
  status: EvaluationStatus;
  criteria: EvaluationCriterionScore[];
  weakClaims: string[];
  sectionsNeedingRevision: string[];
  recommendedChanges: string[];
  createdAt: string;
}

export interface ChannelVariant {
  channel: Channel;
  subject?: string;
  hook: string;
  body: string;
  hashtags: string[];
  characterCount: number;
  guidelineChecks: { label: string; met: boolean }[];
}

export interface ChannelVariants {
  linkedin: ChannelVariant;
  x: ChannelVariant;
  newsletter: ChannelVariant;
}

export type RevisionTrigger = "auto_evaluation" | "human_feedback";

export interface RevisionEntry {
  id: string;
  version: number;
  createdAt: string;
  trigger: RevisionTrigger;
  feedback: string | null;
  summary: string;
  evaluation: EvaluationReport | null;
}

export interface PipelineStage {
  label: string;
  progress: number;
}

export interface ArticleDraft {
  title: string;
  body: string;
  wordCount: number;
}

export interface ContentRequest {
  id: string;
  topic: string;
  audience: Audience;
  sourceType: SourceType;
  sourceInput: string;
  channels: Channel[];
  keywords: string[];
  status: ContentStatus;
  activePipeline: "research" | "revision" | null;
  pendingFeedback: string | null;
  pipelineStage: PipelineStage | null;
  article: ArticleDraft | null;
  sources: SourceCitation[];
  evaluation: EvaluationReport | null;
  channelVariants: ChannelVariants | null;
  revisionHistory: RevisionEntry[];
  rejectionReason: string | null;
  lastError: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContentRequestInput {
  topic: string;
  audience: Audience;
  sourceType: SourceType;
  sourceInput: string;
  channels: Channel[];
  keywords: string[];
  createdBy: string;
}
