-- Stores frontend errors (uncaught exceptions, unhandled promise rejections, React render
-- crashes, and failed action calls) so they're visible somewhere other than a user's own
-- browser console. Written by app/api/errors/route.ts, read by app/dashboard/errors/page.tsx.
create table if not exists client_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null,
  message text not null,
  stack text null,
  url text null,
  role text null,
  context jsonb null
);

create index if not exists client_errors_created_at_idx on client_errors (created_at desc);
