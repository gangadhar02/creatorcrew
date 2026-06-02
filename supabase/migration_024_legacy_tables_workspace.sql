-- ============================================================================
-- migration_024_legacy_tables_workspace.sql
-- Finish multi-tenant isolation for the remaining legacy tables that still
-- leaked the founder's data into new accounts:
--   content_ideas · sync_runs · profiles · profile_posts
--
-- Same pattern as migration_023: add workspace_id, backfill existing rows to
-- the founder's (oldest) workspace, index it. The app now filters every read/
-- write by the current workspace.
--
-- Apply by hand in the Supabase SQL editor.
-- ============================================================================

do $$
declare
  t text;
  founder uuid := (select id from workspaces order by created_at asc limit 1);
begin
  foreach t in array array['content_ideas', 'sync_runs', 'profiles', 'profile_posts']
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format(
      'alter table %I add column if not exists workspace_id uuid references workspaces(id) on delete cascade',
      t
    );
    execute format(
      'update %I set workspace_id = $1 where workspace_id is null', t
    ) using founder;
    execute format(
      'create index if not exists %I on %I (workspace_id)',
      t || '_workspace_idx', t
    );
  end loop;
end$$;
