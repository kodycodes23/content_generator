import "server-only";
import { getSupabaseAdmin } from "./supabase";
import {
  normalizeContentRequestRow,
  type ContentRequest,
  type ContentRequestStatus,
  type RawContentRequestRow,
  type RevisionHistoryEntry,
  type RevisionLogTarget,
} from "./content-request";
import type { Role } from "./role";

// Shared by the Writer's /recall and the Manager's /recall-approval routes — both do the
// same mechanical thing: atomically flip status back a step (the .eq guard closes the race
// where the row moved on between the caller's own pre-check and this update) and append a
// lightweight revision_history entry recording that it happened. Callers own their own
// business-rule pre-checks and error messages; this only does the shared part, and returns
// null (rather than throwing) when the guard doesn't match, so callers can turn that into
// whatever 409 message fits their situation.
export async function revertStatusWithLog(params: {
  id: string;
  fromStatus: ContentRequestStatus;
  toStatus: ContentRequestStatus;
  existingHistory: RevisionHistoryEntry[];
  triggeredBy: Role;
  reviewerNotes: string;
  target: RevisionLogTarget;
  // True for actions that must lose the race to a newsletter send that landed between the
  // caller's own pre-check and this update — e.g. recalling an approval right as it goes out.
  requireNewsletterNotSent?: boolean;
}): Promise<ContentRequest | null> {
  const newEntry: RevisionHistoryEntry = {
    revision_number: params.existingHistory.length + 1,
    timestamp: new Date().toISOString(),
    triggered_by: params.triggeredBy,
    reviewer_notes: params.reviewerNotes,
    score_before: null,
    score_after: null,
    approval_status_after: null,
    target: params.target,
  };

  let query = getSupabaseAdmin()
    .from("content_requests")
    .update({ status: params.toStatus, revision_history: [...params.existingHistory, newEntry] })
    .eq("id", params.id)
    .eq("status", params.fromStatus);

  if (params.requireNewsletterNotSent) {
    query = query.is("newsletter_sent_at", null);
  }

  const { data, error } = await query.select("*").single();

  if (error || !data) return null;
  return normalizeContentRequestRow(data as RawContentRequestRow);
}
