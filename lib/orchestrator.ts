import {
  annotateSourceUsage,
  applyHumanFeedback,
  evaluateDraft,
  generateArticle,
  generateChannelVariants,
  generateSources,
  reviseArticle,
} from "./pipeline";
import { getRequest, listRequests, updateRequest } from "./store";
import type { RevisionEntry } from "./types";

declare global {
  var __koyaPipelineResumed: boolean | undefined;
}

const STAGE_DELAY_MS = 1100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function setStage(id: string, label: string, progress: number): Promise<void> {
  updateRequest(id, () => ({ pipelineStage: { label, progress } }));
  await sleep(STAGE_DELAY_MS);
}

export async function runResearchPipeline(id: string): Promise<void> {
  const request = getRequest(id);
  if (!request) return;

  try {
    updateRequest(id, () => ({ activePipeline: "research", lastError: null }));

    await setStage(id, request.sourceType === "url" ? "Scraping source URL..." : "Researching topic...", 14);
    const sources = generateSources(request);

    await setStage(id, "Extracting citations and excerpts...", 32);
    await setStage(id, "Planning article structure...", 48);

    let article = generateArticle(request, sources);
    await setStage(id, "Drafting SEO article...", 64);

    let evaluation = evaluateDraft(request, article, sources, 1);
    await setStage(id, "Evaluating draft against rubric...", 78);

    const revisionHistory: RevisionEntry[] = [];
    let version = 1;
    while (evaluation.status === "revise" && version < 3) {
      await setStage(id, "Revising weak sections...", 85);
      article = reviseArticle(article, evaluation, sources);
      version += 1;
      const nextEvaluation = evaluateDraft(request, article, sources, version);
      revisionHistory.push({
        id: `rev-${id}-${version}`,
        version,
        createdAt: new Date().toISOString(),
        trigger: "auto_evaluation",
        feedback: null,
        summary: `Auto-revised to address: ${evaluation.recommendedChanges[0] ?? "rubric feedback"}`,
        evaluation: nextEvaluation,
      });
      evaluation = nextEvaluation;
    }

    await setStage(id, "Adapting content for target channels...", 94);
    const channelVariants = generateChannelVariants(request, article);
    const annotatedSources = annotateSourceUsage(article, sources);

    updateRequest(id, () => ({
      status: "pending_review",
      activePipeline: null,
      pipelineStage: null,
      article,
      sources: annotatedSources,
      evaluation,
      channelVariants,
      revisionHistory,
    }));
  } catch (err) {
    updateRequest(id, () => ({
      activePipeline: null,
      pipelineStage: null,
      lastError: err instanceof Error ? err.message : "Research pipeline failed for an unknown reason.",
    }));
  }
}

export async function runRevisionPipeline(id: string, feedback: string): Promise<void> {
  const request = getRequest(id);
  if (!request || !request.article) return;

  try {
    updateRequest(id, () => ({
      status: "drafting",
      activePipeline: "revision",
      pendingFeedback: feedback,
      lastError: null,
      pipelineStage: { label: "Applying reviewer feedback...", progress: 20 },
    }));
    await sleep(STAGE_DELAY_MS);

    const current = getRequest(id);
    if (!current || !current.article) return;

    const revisedArticle = applyHumanFeedback(current.article, feedback, current.sources);
    await setStage(id, "Re-evaluating against rubric...", 55);

    const nextVersion = (current.revisionHistory.at(-1)?.version ?? 1) + 1;
    const evaluation = evaluateDraft(current, revisedArticle, current.sources, nextVersion);
    await setStage(id, "Refreshing channel variants...", 82);

    const channelVariants = generateChannelVariants(current, revisedArticle);
    const annotatedSources = annotateSourceUsage(revisedArticle, current.sources);

    const entry: RevisionEntry = {
      id: `rev-${id}-${nextVersion}`,
      version: nextVersion,
      createdAt: new Date().toISOString(),
      trigger: "human_feedback",
      feedback,
      summary: "Revised based on reviewer feedback.",
      evaluation,
    };

    updateRequest(id, (curr) => ({
      status: "pending_review",
      activePipeline: null,
      pendingFeedback: null,
      pipelineStage: null,
      article: revisedArticle,
      sources: annotatedSources,
      evaluation,
      channelVariants,
      revisionHistory: [...curr.revisionHistory, entry],
    }));
  } catch (err) {
    updateRequest(id, () => ({
      status: "pending_review",
      activePipeline: null,
      pendingFeedback: null,
      pipelineStage: null,
      lastError: err instanceof Error ? err.message : "Revision pipeline failed for an unknown reason.",
    }));
  }
}

export async function runPublishLifecycle(id: string, from: "approved" | "queued"): Promise<void> {
  try {
    if (from === "approved") {
      await sleep(1800);
      const current = getRequest(id);
      if (!current || current.status !== "approved") return;
      updateRequest(id, () => ({ status: "queued" }));
    }

    await sleep(6500);
    const current = getRequest(id);
    if (!current || current.status !== "queued") return;
    updateRequest(id, () => ({ status: "published" }));
  } catch (err) {
    updateRequest(id, () => ({
      lastError: err instanceof Error ? err.message : "Publishing pipeline failed for an unknown reason.",
    }));
  }
}

export function resumeInFlightPipelines(): void {
  if (globalThis.__koyaPipelineResumed) return;
  globalThis.__koyaPipelineResumed = true;

  for (const request of listRequests()) {
    if (request.status === "drafting" && request.activePipeline === "revision") {
      runRevisionPipeline(request.id, request.pendingFeedback ?? "Please tighten this draft.").catch((err) =>
        console.error("[koya] failed to resume revision pipeline", request.id, err),
      );
    } else if (request.status === "drafting") {
      runResearchPipeline(request.id).catch((err) =>
        console.error("[koya] failed to resume research pipeline", request.id, err),
      );
    } else if (request.status === "approved") {
      runPublishLifecycle(request.id, "approved").catch((err) =>
        console.error("[koya] failed to resume publish pipeline", request.id, err),
      );
    } else if (request.status === "queued") {
      runPublishLifecycle(request.id, "queued").catch((err) =>
        console.error("[koya] failed to resume publish pipeline", request.id, err),
      );
    }
  }
}
