-- Array of revision entries: { revision_number, timestamp, triggered_by, reviewer_notes,
-- score_before, score_after, approval_status_after } — see lib/content-request.ts's
-- RevisionHistoryEntry type for the exact shape. Defaults to '[]' (applied retroactively
-- to existing rows too) rather than NULL — the app's normalizer handles either fine.
alter table content_requests
  add column if not exists revision_history jsonb default '[]'::jsonb;
