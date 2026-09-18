-- Lets a manager schedule a newsletter to fire automatically at a future time, checked by
-- an external cron hitting app/api/cron/send-scheduled-newsletters. Nullable — null means
-- "not scheduled"; cleared back to null once sent (or cancelled).
alter table content_requests
  add column if not exists scheduled_send_at timestamptz null;
