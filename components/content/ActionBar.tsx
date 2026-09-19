"use client";

import { useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Lock,
  Loader2,
  Mail,
  MessageSquarePlus,
  RotateCcw,
  Rocket,
  Send,
  TriangleAlert,
  Wand2,
  XCircle,
} from "lucide-react";
import { useRequiredRole } from "./RoleContext";
import { SimpleMarkdown } from "./SimpleMarkdown";
import { ROLE_HEADER, type Role } from "@/lib/role";
import { logClientError } from "@/lib/log-client-error";
import { formatDateTime } from "@/lib/format";
import { SUBSCORE_KEYS, SUBSCORE_LABELS } from "@/lib/rubric";
import { REVISION_TARGETS, REVISION_TARGET_LABELS } from "@/lib/content-request";
import type { ContentRequest, ContentRequestStatus, RevisionTarget } from "@/lib/content-request";

type Panel = "none" | "revise" | "reject" | "send-newsletter" | "schedule-send";
type RevisionMode = "targeted" | "full";

// datetime-local wants "YYYY-MM-DDTHH:mm" in the browser's local time, with no timezone
// suffix — used as both the input's `min` and to build its initial value.
function nowLocalDatetimeString(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

// Statuses a Content Writer can act from — Send for Approval and Request Revision (the
// AI-triggering one) share this exact set: a writer can hand off to the manager, or send
// to the automated workflow, from either a fresh pipeline draft or one the manager just
// flagged back to them.
const WRITER_ACTIONABLE_STATUSES: ContentRequestStatus[] = ["pending_human_review", "revision_requested"];

const STATUS_MESSAGE: Record<Role, Partial<Record<ContentRequestStatus, string>>> = {
  content_writer: {
    researching: "Waiting on the automated pipeline.",
    pending_human_review: "Ready to send for approval.",
    submitted_for_approval: "Sent for approval — waiting on a manager.",
    revision_requested: "Needs rework before it can be sent again.",
    approved: "Approved — waiting to be published.",
    published: "Published. No further action needed.",
    rejected: "This request was rejected.",
  },
  manager: {
    researching: "Not ready yet — still with the automated pipeline.",
    pending_human_review: "Not yet submitted by the writer.",
    submitted_for_approval: "Awaiting your decision.",
    revision_requested: "Sent back for revision.",
    approved: "Approved — ready to publish.",
    published: "Published. No further action needed.",
    rejected: "This request was rejected.",
  },
};

function LockedNotice({ sentAt }: { sentAt: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span>
        <span className="font-medium text-slate-700">Published — locked. </span>
        Newsletter sent {formatDateTime(sentAt)}. This request can no longer be revised, rejected, or resubmitted.
      </span>
    </div>
  );
}

function ScheduledNotice({
  scheduledAt,
  submitting,
  onCancel,
}: {
  scheduledAt: string;
  submitting: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs text-indigo-800">
      <span className="inline-flex items-center gap-1.5">
        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
        Scheduled for {formatDateTime(scheduledAt)}
      </span>
      <button
        type="button"
        disabled={submitting}
        onClick={onCancel}
        className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Cancel schedule
      </button>
    </div>
  );
}

export function ActionBar({
  request,
  onAction,
}: {
  request: ContentRequest;
  onAction: (updated: ContentRequest) => void;
}) {
  const { role } = useRequiredRole();
  const [panel, setPanel] = useState<Panel>("none");
  const [revisionMode, setRevisionMode] = useState<RevisionMode>("targeted");
  const [targetField, setTargetField] = useState<RevisionTarget | "">("");
  const [notes, setNotes] = useState("");
  const [scheduledAt, setScheduledAt] = useState(nowLocalDatetimeString());
  const [submitting, setSubmitting] = useState(false);
  const [deepRevising, setDeepRevising] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSpecificity, setCheckingSpecificity] = useState(false);
  const [specificityWarning, setSpecificityWarning] = useState<string | null>(null);

  const isMock = request.id.startsWith("demo-");

  // Once the newsletter has gone out, the row is locked from further revision, rejection,
  // or resubmission — an email that's already delivered can't be un-sent. The server-side
  // routes enforce this independently; this only controls what's shown here.
  const locked = !!request.newsletter_sent_at;

  // Every gate below is a status-set membership check keyed off `role` — the same shape
  // whether the role comes from localStorage (today) or a real session (later).
  const writerCanAct = role === "content_writer" && !locked && WRITER_ACTIONABLE_STATUSES.includes(request.status);
  const canSubmit = writerCanAct;
  const canRevise = writerCanAct; // writer's Request Revision — opens the targeted/full-revision panel
  const canDecide = role === "manager" && !locked && request.status === "submitted_for_approval"; // Approve, Reject, and manager's Request Revision
  // Lets a writer pull a request back out of the approval queue before a Manager has acted
  // on it — e.g. right after noticing a mistake post-submit. Only meaningful exactly at
  // submitted_for_approval; server-side re-checks this atomically too.
  const canRecall = role === "content_writer" && !locked && request.status === "submitted_for_approval";
  const canPublish = role === "manager" && request.status === "approved"; // Mark as Published stays manager-only
  const newsletterVariant = request.channel_variants?.newsletter;
  // Either role can send/schedule the newsletter once approved — a Writer still can't send
  // something a Manager hasn't approved (status === "approved" is the actual gate, enforced
  // server-side too), but from that point on either of them can trigger it.
  const canSendNewsletter = request.status === "approved" && !locked && !!newsletterVariant;
  const isApprovedView = request.status === "approved" && !locked; // the shared send/schedule/(publish) block, for either role
  // Lets a Manager pull a request back out of "approved" for another look before it's
  // actually sent — same idea as the Writer's Recall submission, one status back.
  const canRecallApproval = role === "manager" && isApprovedView;

  // Criteria below the 7/10 quality bar — drives the "Full revision" option's preview text
  // and whether it's available at all. Mirrors the same threshold deep-revise enforces
  // server-side.
  const rubricScores = request.evaluation_report?.scores;
  const weakCriteria = rubricScores
    ? SUBSCORE_KEYS.filter((key) => typeof rubricScores[key] === "number" && (rubricScores[key] as number) < 7).map(
        (key) => ({ key, score: rubricScores[key] as number }),
      )
    : [];

  const cappedOut = canDecide && request.evaluation_report?.exit_reason === "max_iterations_reached";

  function openRevisePanel() {
    setSpecificityWarning(null);
    setRevisionMode("targeted");
    setTargetField("");
    if (panel === "revise") {
      setPanel("none");
      return;
    }
    // A writer picking up a note left on an old-style revision_requested row gets it
    // pre-filled, editable — harmless backward-compat for rows from before targeted-revise.
    const prefill =
      role === "content_writer" && request.status === "revision_requested" && request.reviewer_notes
        ? request.reviewer_notes
        : "";
    setNotes(prefill);
    setPanel("revise");
  }

  // Manager's "Request Revision" is a note-only handoff back to the Writer — no AI, no
  // content changes, just a status flip + notification email. The Writer is the only one
  // who can actually revise content, via /targeted-revise or /deep-revise below.
  async function submitManagerRevisionRequest() {
    setCheckingSpecificity(true);
    setError(null);
    try {
      const res = await fetch(`/api/content-requests/${request.id}/check-revision-specificity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewer_notes: notes }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.specific === false) {
          setSpecificityWarning(data.suggestion || "This note may be too vague for the writer to act on.");
          setCheckingSpecificity(false);
          return;
        }
      }
    } catch {
      // Network error reaching the check — fall through and submit anyway.
    }
    setCheckingSpecificity(false);
    await post(`/api/content-requests/${request.id}/flag-for-revision`, { reviewer_notes: notes });
  }

  // Advisory only — checks whether the note is specific enough to act on before actually
  // submitting the revision request. Fails open: if the check itself errors or the API
  // isn't configured, the submission proceeds rather than being blocked by an infra hiccup.
  async function submitTargetedReviseWithCheck() {
    if (!targetField) return;
    setCheckingSpecificity(true);
    setError(null);
    try {
      const res = await fetch(`/api/content-requests/${request.id}/check-revision-specificity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewer_notes: notes }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.specific === false) {
          setSpecificityWarning(data.suggestion || "This note may be too vague to act on.");
          setCheckingSpecificity(false);
          return;
        }
      }
    } catch {
      // Network error reaching the check — fall through and submit anyway.
    }
    setCheckingSpecificity(false);
    await post(`/api/content-requests/${request.id}/targeted-revise`, { target: targetField, note: notes });
  }

  // Deep-revise can take 15-30+ seconds (multiple sequential/parallel Claude calls) — sets
  // the shared `submitting` flag too so every other action button is correctly disabled
  // while a revision this significant is in flight, not just this one.
  async function runDeepRevise() {
    if (isMock) {
      setError("This is example data — actions aren't wired to a real request.");
      return;
    }
    setSubmitting(true);
    setDeepRevising(true);
    setError(null);
    try {
      const res = await fetch(`/api/content-requests/${request.id}/deep-revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json", [ROLE_HEADER]: role },
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.error ?? "Could not run the full revision.";
        setError(message);
        logClientError("action_failed", new Error(message), {
          path: `/api/content-requests/${request.id}/deep-revise`,
          status: res.status,
        });
        setSubmitting(false);
        setDeepRevising(false);
        return;
      }
      setPanel("none");
      setSubmitting(false);
      setDeepRevising(false);
      onAction(data);
    } catch (err) {
      setError("Could not reach the server.");
      logClientError("action_failed", err, { path: `/api/content-requests/${request.id}/deep-revise` });
      setSubmitting(false);
      setDeepRevising(false);
    }
  }

  async function post(path: string, body?: Record<string, unknown>) {
    if (isMock) {
      setError("This is example data — actions aren't wired to a real request.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", [ROLE_HEADER]: role },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.error ?? "Something went wrong.";
        setError(message);
        logClientError("action_failed", new Error(message), { path, status: res.status });
        setSubmitting(false);
        return;
      }
      setPanel("none");
      setNotes("");
      setSubmitting(false);
      onAction(data);
    } catch (err) {
      setError("Could not reach the server.");
      logClientError("action_failed", err, { path });
      setSubmitting(false);
    }
  }

  // Shared by both recall-style actions (Writer recalling a submission, Manager recalling
  // an approval) — same confirm-then-post-then-reload-on-stale-409 shape either way.
  async function recallAction(endpoint: string, confirmMessage: string, defaultErrorMessage: string) {
    if (isMock) {
      setError("This is example data — actions aren't wired to a real request.");
      return;
    }
    if (!window.confirm(confirmMessage)) return;

    setSubmitting(true);
    setError(null);
    const path = `/api/content-requests/${request.id}/${endpoint}`;
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", [ROLE_HEADER]: role },
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.error ?? defaultErrorMessage;
        setError(message);
        logClientError("action_failed", new Error(message), { path, status: res.status });
        setSubmitting(false);
        if (res.status === 409) {
          // Stale view — the state moved on since this page loaded. Reload shortly so the
          // user sees the real current status instead of continuing to look at a view that
          // no longer reflects reality.
          window.setTimeout(() => window.location.reload(), 1500);
        }
        return;
      }
      setSubmitting(false);
      onAction(data);
    } catch (err) {
      setError("Could not reach the server.");
      logClientError("action_failed", err, { path });
      setSubmitting(false);
    }
  }

  function handleRecall() {
    return recallAction("recall", "Are you sure you want to pull this back from review?", "Could not recall this submission.");
  }

  function handleRecallApproval() {
    return recallAction(
      "recall-approval",
      "Pull this back from approved status for another look?",
      "Could not recall this approval.",
    );
  }

  return (
    <div className="border-t border-slate-200 bg-white">
      {error && <div className="border-b border-red-100 bg-red-50 px-5 py-2 text-xs text-red-700">{error}</div>}

      {cappedOut && panel === "none" && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-xs text-amber-800">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            This draft never cleared the quality threshold on its own (score:{" "}
            {request.evaluation_score.toFixed(1)}/10
            {typeof request.evaluation_report?.iterations_used === "number"
              ? ` after ${request.evaluation_report.iterations_used} revisions`
              : ""}
            ) — review carefully before approving.
          </span>
        </div>
      )}

      {panel === "revise" && canDecide && (
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <p className="mb-2 text-xs font-medium text-slate-600">
            What needs to change? This sends the request back to the Writer with your note — they&apos;ll make the
            actual revision, not you.
          </p>
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setSpecificityWarning(null);
            }}
            rows={3}
            autoFocus
            placeholder="e.g. Tighten the intro and add a stronger data point in the research section."
            className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
          />

          {specificityWarning && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-medium">This note might be too vague to act on. </span>
                {specificityWarning}
              </span>
            </div>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => {
                setPanel("none");
                setSpecificityWarning(null);
              }}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
            {specificityWarning ? (
              <>
                <button
                  onClick={() => setSpecificityWarning(null)}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Edit notes
                </button>
                <button
                  disabled={submitting}
                  onClick={() => post(`/api/content-requests/${request.id}/flag-for-revision`, { reviewer_notes: notes })}
                  className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                  Submit anyway
                </button>
              </>
            ) : (
              <button
                disabled={submitting || checkingSpecificity || notes.trim().length < 5}
                onClick={submitManagerRevisionRequest}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {(checkingSpecificity || submitting) && <Loader2 className="h-3 w-3 animate-spin" />}
                {checkingSpecificity ? "Checking…" : submitting ? "Sending…" : "Send to Writer"}
              </button>
            )}
          </div>
        </div>
      )}

      {panel === "revise" && canRevise && (
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <div className="mb-3 inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setRevisionMode("targeted")}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                revisionMode === "targeted" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Edit a specific part
            </button>
            <button
              type="button"
              onClick={() => setRevisionMode("full")}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                revisionMode === "full" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Full revision
            </button>
          </div>

          {revisionMode === "targeted" ? (
            <>
              <p className="mb-2 text-xs font-medium text-slate-600">
                Makes a surgical, minimal edit to exactly one part — nothing else is touched. Runs immediately, no
                handoff to anyone else.
              </p>
              <select
                value={targetField}
                onChange={(e) => {
                  setTargetField(e.target.value as RevisionTarget | "");
                  setSpecificityWarning(null);
                }}
                className="mb-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-slate-400 focus:outline-none"
              >
                <option value="">What do you want to change?</option>
                {REVISION_TARGETS.map((t) => (
                  <option key={t} value={t}>
                    {REVISION_TARGET_LABELS[t]}
                  </option>
                ))}
              </select>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setSpecificityWarning(null);
                }}
                rows={3}
                placeholder="What specifically should change? e.g. Change 'streamline' to 'simplify' in the second paragraph."
                className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
              />

              {specificityWarning && (
                <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    <span className="font-medium">This note might be too vague to act on. </span>
                    {specificityWarning}
                  </span>
                </div>
              )}

              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setPanel("none");
                    setSpecificityWarning(null);
                  }}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                >
                  Cancel
                </button>
                {specificityWarning ? (
                  <>
                    <button
                      onClick={() => setSpecificityWarning(null)}
                      className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Edit notes
                    </button>
                    <button
                      disabled={submitting || !targetField}
                      onClick={() =>
                        post(`/api/content-requests/${request.id}/targeted-revise`, { target: targetField, note: notes })
                      }
                      className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                      Submit anyway
                    </button>
                  </>
                ) : (
                  <button
                    disabled={submitting || checkingSpecificity || !targetField || notes.trim().length < 5}
                    onClick={submitTargetedReviseWithCheck}
                    className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {(checkingSpecificity || submitting) && <Loader2 className="h-3 w-3 animate-spin" />}
                    {checkingSpecificity ? "Checking…" : submitting ? "Revising…" : "Submit Edit"}
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="mb-2 text-xs font-medium text-slate-600">
                Automatically revises only the criteria below the 7/10 quality bar, re-scores the draft, and logs the
                change — no manual note needed.
              </p>

              {weakCriteria.length === 0 ? (
                <p className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-500">
                  All criteria already score 7+ — no automatic revision needed.
                </p>
              ) : (
                <p className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-600">
                  <span className="font-medium text-slate-700">Will improve: </span>
                  {weakCriteria.map((c) => `${SUBSCORE_LABELS[c.key]} (${c.score.toFixed(1)})`).join(", ")}
                </p>
              )}

              {deepRevising && (
                <div className="mt-2 flex items-start gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-2 text-[11px] text-indigo-700">
                  <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                  <span>Running full revision — this can take 15-30+ seconds (multiple AI calls). Don&apos;t close this page.</span>
                </div>
              )}

              <div className="mt-2 flex justify-end gap-2">
                <button
                  disabled={deepRevising}
                  onClick={() => setPanel("none")}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  disabled={weakCriteria.length === 0 || submitting}
                  onClick={runDeepRevise}
                  className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deepRevising ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                  {deepRevising ? "Revising…" : "Run Full Revision"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {panel === "reject" && canDecide && (
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <p className="mb-2 text-xs font-medium text-slate-600">Reason for rejecting (required).</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            autoFocus
            placeholder="e.g. Off-brand angle, duplicate topic, no longer relevant."
            className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setPanel("none")}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              disabled={submitting || notes.trim().length < 5}
              onClick={() => post(`/api/content-requests/${request.id}/reject`, { reviewer_notes: notes })}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
              Confirm reject
            </button>
          </div>
        </div>
      )}

      {panel === "send-newsletter" && canSendNewsletter && newsletterVariant && (
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <p className="mb-2 text-xs font-medium text-slate-600">
            This will immediately email the newsletter below — review before sending.
          </p>
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Subject</p>
            <p className="mt-0.5 text-sm font-medium text-slate-900">
              {newsletterVariant.subject_line || "(no subject line)"}
            </p>
            {newsletterVariant.preview_text && (
              <>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Preview text</p>
                <p className="mt-0.5 text-xs text-slate-600">{newsletterVariant.preview_text}</p>
              </>
            )}
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Body</p>
            <div className="mt-1 max-h-64 overflow-y-auto rounded-md border border-slate-100 bg-slate-50 p-2.5">
              <SimpleMarkdown text={newsletterVariant.body_markdown} />
            </div>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setPanel("none")}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              disabled={submitting}
              onClick={() => post(`/api/content-requests/${request.id}/send-newsletter`)}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
              Confirm &amp; Send
            </button>
          </div>
        </div>
      )}

      {panel === "schedule-send" && canSendNewsletter && !request.scheduled_send_at && (
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <p className="mb-2 text-xs font-medium text-slate-600">
            Pick when the newsletter should send automatically — no need to be online at that time.
          </p>
          <input
            type="datetime-local"
            value={scheduledAt}
            min={nowLocalDatetimeString()}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-slate-400 focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setPanel("none")}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              disabled={submitting || !scheduledAt}
              onClick={() =>
                post(`/api/content-requests/${request.id}/schedule-send`, {
                  scheduled_send_at: new Date(scheduledAt).toISOString(),
                })
              }
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
              Confirm Schedule
            </button>
          </div>
        </div>
      )}

      <div className="p-4">
        <p className="mb-3 text-xs text-slate-400">{STATUS_MESSAGE[role][request.status]}</p>

        {locked ? (
          <LockedNotice sentAt={request.newsletter_sent_at!} />
        ) : isApprovedView ? (
          <div className="space-y-2">
            {canSendNewsletter && (
              <button
                onClick={() => setPanel(panel === "send-newsletter" ? "none" : "send-newsletter")}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" />
                Send Newsletter
              </button>
            )}

            {canSendNewsletter &&
              (request.scheduled_send_at ? (
                <ScheduledNotice
                  scheduledAt={request.scheduled_send_at}
                  submitting={submitting}
                  onCancel={() => post(`/api/content-requests/${request.id}/schedule-send`, { scheduled_send_at: null })}
                />
              ) : (
                <button
                  onClick={() => setPanel(panel === "schedule-send" ? "none" : "schedule-send")}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                  Schedule Send
                </button>
              ))}

            {canPublish && (
              <button
                disabled={submitting}
                onClick={() => post(`/api/content-requests/${request.id}/publish`)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-2.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                Mark as Published
              </button>
            )}

            {canRecallApproval && (
              <button
                disabled={submitting}
                onClick={handleRecallApproval}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                Recall approval
              </button>
            )}
          </div>
        ) : role === "content_writer" ? (
          <>
            {canRecall && (
              <button
                disabled={submitting}
                onClick={handleRecall}
                className="mb-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                Recall submission
              </button>
            )}
            <button
              disabled={!canRevise}
              onClick={openRevisePanel}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" />
              Request Revision
            </button>
            <button
              disabled={!canSubmit || submitting}
              onClick={() => post(`/api/content-requests/${request.id}/submit-for-approval`)}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-2.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send for Approval
            </button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={!canDecide}
                onClick={openRevisePanel}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" />
                Request Revision
              </button>
              <button
                disabled={!canDecide}
                onClick={() => setPanel(panel === "reject" ? "none" : "reject")}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 py-2.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                Reject
              </button>
            </div>

            <button
              disabled={!canDecide || submitting}
              onClick={() => post(`/api/content-requests/${request.id}/approve`)}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-2.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Approve &amp; Queue for Publishing
            </button>
          </>
        )}
      </div>
    </div>
  );
}
