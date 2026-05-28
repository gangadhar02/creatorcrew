-- Migration 019 — analyzer_jobs (Profile Analyzer queue)
--
-- Vercel functions hit Instagram from AWS IPs, which IG rate-limits hard
-- (429 after a few requests). Workaround: Vercel enqueues an analyzer
-- job into this table, then triggers a GitHub Actions workflow_dispatch
-- which runs from a different IP space and writes the result back here.
-- The client polls /api/profiles/analyze/[id] to see when status flips
-- to 'completed'.

create table if not exists analyzer_jobs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  handle          text not null,
  cap             integer not null default 90,
  status          text not null default 'queued'
                    check (status in ('queued','running','completed','failed')),
  error_message   text,
  creator_id      uuid references creators(id) on delete set null,
  profile_id      uuid references profiles(id) on delete set null,
  posts_synced    integer default 0,
  workflow_run_url text,
  enqueued_at     timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz
);

create index if not exists analyzer_jobs_workspace_idx
  on analyzer_jobs (workspace_id, enqueued_at desc);
create index if not exists analyzer_jobs_status_idx
  on analyzer_jobs (status, enqueued_at);

-- ============================================================================
-- RLS — service role bypasses (used by Vercel + GitHub Actions CLI).
-- Authenticated users only see their own workspace's jobs.
-- ============================================================================
alter table analyzer_jobs enable row level security;
drop policy if exists "ws_owner_all_analyzer_jobs" on analyzer_jobs;
create policy "ws_owner_all_analyzer_jobs" on analyzer_jobs for all to authenticated
  using (is_workspace_owner(workspace_id))
  with check (is_workspace_owner(workspace_id));
