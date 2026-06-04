-- ============================================================================
-- migration_029_workspace_activity.sql
-- GitHub-style activity streak for the home page.
--
-- One row per (workspace, calendar day) the workspace was active. The home
-- page upserts today's row on every visit, then renders a contribution-grid
-- heatmap + current streak from the last few months of rows.
--
-- Apply by hand in the Supabase SQL editor.
-- ============================================================================

create table if not exists workspace_activity (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  day          date not null,
  created_at   timestamptz not null default now(),
  primary key (workspace_id, day)
);

create index if not exists workspace_activity_ws_day_idx
  on workspace_activity (workspace_id, day desc);

alter table workspace_activity enable row level security;

-- Owner-only access (server uses the service-role key and bypasses RLS; this
-- guards the browser anon client, consistent with the other workspace tables).
drop policy if exists workspace_activity_select on workspace_activity;
create policy workspace_activity_select on workspace_activity
  for select using (is_workspace_owner(workspace_id));

drop policy if exists workspace_activity_insert on workspace_activity;
create policy workspace_activity_insert on workspace_activity
  for insert with check (is_workspace_owner(workspace_id));
