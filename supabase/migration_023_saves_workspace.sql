-- ============================================================================
-- migration_023_saves_workspace.sql
-- Scope the `saves` table to a workspace so new accounts don't see the
-- founder's personal Instagram saves.
--
-- `saves` was a legacy single-tenant table (migration_017 left it without a
-- workspace concept and RLS disabled). With real signups, every server read
-- returned the global set to every user. This adds workspace_id, backfills the
-- existing rows to the founder's (oldest) workspace, and tightens the Realtime
-- read policy to the owning workspace.
--
-- Apply by hand in the Supabase SQL editor.
-- ============================================================================

alter table saves
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade;

-- Backfill existing saves to the founder's workspace. The founder's workspace
-- is the oldest one (it was seeded before multi-user auth in migration_017).
-- If that's not correct for you, replace the subquery with the right id.
update saves
  set workspace_id = (select id from workspaces order by created_at asc limit 1)
  where workspace_id is null;

create index if not exists saves_workspace_idx on saves(workspace_id);

-- Tighten the Realtime/authenticated read policy from `using (true)`
-- (migration_021) to the owning workspace only.
drop policy if exists "saves_authenticated_read" on saves;
drop policy if exists "saves_workspace_read" on saves;
create policy "saves_workspace_read" on saves
  for select to authenticated
  using (is_workspace_owner(workspace_id));
