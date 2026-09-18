"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Eye, Loader2, MessageSquare, XCircle } from "lucide-react";
import { ScoreBadge, StatusPill } from "./ArticleReviewPanel";
import { PipelineErrorBanner } from "./PipelineStatus";
import { SourceViewer } from "./SourceViewer";
import { ArticleCanvas } from "./ArticleCanvas";
import { EvaluationPanel } from "./EvaluationPanel";
import { ChannelPreview } from "./ChannelPreview";
import { ManagerPreview } from "./ManagerPreview";
import { ActionBar } from "./ActionBar";
import { useRequiredRole } from "./RoleContext";
import { CHANNEL_LABEL, formatDate } from "@/lib/format";
import type { ContentRequest } from "@/lib/content-request";

export function ReviewWorkspace({ initialRequest }: { initialRequest: ContentRequest }) {
  const { role } = useRequiredRole();
  const [request, setRequest] = useState(initialRequest);
  // Defaults on for a Manager looking at something awaiting their decision — freely
  // toggleable from there. Writers never get this view at all (see showPreviewToggle below).
  const [previewMode, setPreviewMode] = useState(
    role === "manager" && initialRequest.status === "submitted_for_approval",
  );

  const hasArticle = request.article_draft.trim().length > 0;
  const channelTargets = request.channel_targets ?? [];
  const showPreviewToggle = role === "manager" && request.status === "submitted_for_approval";
  const showPreview = showPreviewToggle && previewMode;

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-slate-900">{request.title}</h1>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">
              {request.updated_at ? formatDate(request.updated_at) : "—"}
              {request.target_audience ? ` · ${request.target_audience}` : ""}
              {channelTargets.length > 0 ? ` · ${channelTargets.map((c) => CHANNEL_LABEL[c]).join(", ")}` : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showPreviewToggle && (
            <button
              type="button"
              onClick={() => setPreviewMode((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                previewMode
                  ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              {previewMode ? "Previewing" : "Preview"}
            </button>
          )}
          {request.evaluation_report && <ScoreBadge score={request.evaluation_score} />}
          <StatusPill status={request.status} />
        </div>
      </div>

      {request.error_message && <PipelineErrorBanner message={request.error_message} />}

      {request.status === "rejected" && request.reviewer_notes && (
        <div className="flex items-start gap-2.5 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-xs text-slate-600">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
          <span>
            <span className="font-medium text-slate-700">Rejected: </span>
            {request.reviewer_notes}
          </span>
        </div>
      )}

      {request.status === "revision_requested" && request.reviewer_notes && (
        <div className="flex items-start gap-2.5 border-b border-indigo-100 bg-indigo-50 px-5 py-2.5 text-xs text-indigo-700">
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <span className="font-medium">Revision requested: </span>
            {request.reviewer_notes}
          </span>
        </div>
      )}

      {!hasArticle ? (
        <div className="flex flex-1 items-center justify-center px-8 py-16">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-8 py-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <div>
              <p className="text-sm font-medium text-slate-700">Still being researched</p>
              <p className="mt-1 max-w-xs text-xs text-slate-400">
                This request doesn&apos;t have a draft yet. Refresh the page to check for updates.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[26%] min-w-[260px] max-w-[340px] shrink-0 overflow-hidden border-r border-slate-200 bg-white">
            <SourceViewer
              sources={request.sources}
              evaluationReport={request.evaluation_report}
              researchedAt={request.created_at}
              attachmentUrl={request.attachment_url}
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col border-r border-slate-200 bg-white">
            {showPreview ? (
              <ManagerPreview
                title={request.title}
                metaDescription={request.meta_description}
                articleDraft={request.article_draft}
                featuredImageUrl={request.featured_image_url}
                internalLinks={request.internal_links}
              />
            ) : (
              <ArticleCanvas
                requestId={request.id}
                title={request.title}
                articleDraft={request.article_draft}
                featuredImageUrl={request.featured_image_url}
                internalLinks={request.internal_links}
                editable={request.status === "pending_human_review"}
                onSaved={(fields) => setRequest((r) => ({ ...r, ...fields }))}
              />
            )}
          </div>

          <div className="flex w-[26%] min-w-[280px] max-w-[360px] shrink-0 flex-col bg-white">
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <EvaluationPanel
                evaluationScore={request.evaluation_score}
                evaluationReport={request.evaluation_report}
                researchedKeywords={request.researched_keywords}
                revisionHistory={request.revision_history}
              />
              <div className="border-t border-slate-200">
                <ChannelPreview channelTargets={channelTargets} variants={request.channel_variants} />
              </div>
            </div>
            <ActionBar request={request} onAction={(updated) => setRequest(updated)} />
          </div>
        </div>
      )}
    </div>
  );
}
