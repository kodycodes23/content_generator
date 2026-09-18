-- Adds a lock timestamp: once a request's newsletter has been sent, the row is locked
-- from further revision/rejection/resubmission (enforced in application code — see
-- app/api/content-requests/[id]/{revise,reject,submit-for-approval}/route.ts).
ALTER TABLE content_requests
  ADD COLUMN IF NOT EXISTS newsletter_sent_at timestamptz NULL;
