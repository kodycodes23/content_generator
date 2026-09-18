import {
  annotateSourceUsage,
  evaluateDraft,
  generateArticle,
  generateChannelVariants,
  generateSources,
  reviseArticle,
} from "./pipeline";
import type { ContentRequest, RevisionEntry } from "./types";

const DEMO_USER = "agorua.kody@gmail.com";

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

interface SeedInput {
  id: string;
  topic: string;
  audience: ContentRequest["audience"];
  sourceType: ContentRequest["sourceType"];
  sourceInput: string;
  channels: ContentRequest["channels"];
  keywords: string[];
  createdHoursAgo: number;
}

function base(input: SeedInput): ContentRequest {
  return {
    id: input.id,
    topic: input.topic,
    audience: input.audience,
    sourceType: input.sourceType,
    sourceInput: input.sourceInput,
    channels: input.channels,
    keywords: input.keywords,
    status: "drafting",
    activePipeline: null,
    pendingFeedback: null,
    pipelineStage: null,
    article: null,
    sources: [],
    evaluation: null,
    channelVariants: null,
    revisionHistory: [],
    rejectionReason: null,
    lastError: null,
    createdBy: DEMO_USER,
    createdAt: hoursAgo(input.createdHoursAgo),
    updatedAt: hoursAgo(input.createdHoursAgo),
  };
}

function buildFullyGenerated(input: SeedInput, finalStatus: ContentRequest["status"]): ContentRequest {
  const request = base(input);
  const sources = generateSources(request);
  let article = generateArticle(request, sources);
  let evaluation = evaluateDraft(request, article, sources, 1);
  const revisionHistory: RevisionEntry[] = [];
  let version = 1;

  while (evaluation.status === "revise" && version < 3) {
    article = reviseArticle(article, evaluation, sources);
    version += 1;
    const next = evaluateDraft(request, article, sources, version);
    revisionHistory.push({
      id: `rev-${input.id}-${version}`,
      version,
      createdAt: hoursAgo(input.createdHoursAgo - version * 0.2),
      trigger: "auto_evaluation",
      feedback: null,
      summary: `Auto-revised to address: ${evaluation.recommendedChanges[0] ?? "rubric feedback"}`,
      evaluation: next,
    });
    evaluation = next;
  }

  const channelVariants = generateChannelVariants(request, article);
  const annotatedSources = annotateSourceUsage(article, sources);

  return {
    ...request,
    status: finalStatus,
    article,
    sources: annotatedSources,
    evaluation,
    channelVariants,
    revisionHistory,
    updatedAt: hoursAgo(Math.max(input.createdHoursAgo - revisionHistory.length * 0.3, 0.1)),
  };
}

export function buildSeedRequests(): ContentRequest[] {
  const pendingReview = buildFullyGenerated(
    {
      id: "req-koya-001",
      topic: "Why top candidates ghost after the first interview",
      audience: "practitioner",
      sourceType: "url",
      sourceInput: "https://www.shrm.org/topics-tools/news/talent-acquisition/candidate-ghosting-trends",
      channels: ["linkedin", "x", "newsletter"],
      keywords: ["candidate experience", "interview process", "talent acquisition"],
      createdHoursAgo: 5,
    },
    "pending_review",
  );

  const pendingReviewTwo = buildFullyGenerated(
    {
      id: "req-koya-002",
      topic: "How AI search is changing employer branding SEO",
      audience: "technical",
      sourceType: "none",
      sourceInput: "",
      channels: ["linkedin", "newsletter"],
      keywords: ["employer branding SEO"],
      createdHoursAgo: 9,
    },
    "pending_review",
  );

  const queued = buildFullyGenerated(
    {
      id: "req-koya-003",
      topic: "The real cost of a slow hiring process",
      audience: "executive",
      sourceType: "text",
      sourceInput:
        "Internal recruiting ops memo: average time-to-fill grew from 34 to 51 days this year. Hiring managers report losing top candidates to competitors who move faster, even when the offer is comparable. Two roles were re-opened after finalists accepted competing offers during a two-week internal approval delay.",
      channels: ["linkedin", "newsletter"],
      keywords: ["time to hire", "recruiting efficiency"],
      createdHoursAgo: 30,
    },
    "queued",
  );

  const published = buildFullyGenerated(
    {
      id: "req-koya-004",
      topic: "Building a talent brand without a Fortune 500 budget",
      audience: "executive",
      sourceType: "none",
      sourceInput: "",
      channels: ["linkedin", "x", "newsletter"],
      keywords: ["employer branding", "talent brand"],
      createdHoursAgo: 96,
    },
    "published",
  );

  const rejected = buildFullyGenerated(
    {
      id: "req-koya-005",
      topic: "Why remote-first teams still need an office",
      audience: "practitioner",
      sourceType: "url",
      sourceInput: "https://www.wework.com/ideas/professional-development/management-leadership/remote-first-hybrid-work",
      channels: ["linkedin"],
      keywords: ["hybrid work"],
      createdHoursAgo: 50,
    },
    "rejected",
  );
  rejected.rejectionReason =
    "Thesis contradicts our current published stance on remote-first hiring. Needs a different angle before this can move forward.";

  const drafting: ContentRequest = {
    ...base({
      id: "req-koya-006",
      topic: "Employer branding for companies that aren't FAANG",
      audience: "executive",
      sourceType: "none",
      sourceInput: "",
      channels: ["linkedin", "newsletter"],
      keywords: ["employer branding"],
      createdHoursAgo: 0.02,
    }),
    status: "drafting",
    activePipeline: "research",
    pipelineStage: { label: "Queued for research...", progress: 4 },
  };

  return [pendingReview, pendingReviewTwo, queued, published, rejected, drafting];
}
