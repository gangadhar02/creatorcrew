-- ============================================================================
-- migration_021_saves_realtime.sql
-- Enable Supabase Realtime for the `saves` table so the webapp's Saves page
-- updates live when a GitHub Actions sync inserts rows (no manual refresh).
--
-- WHY THIS IS NEEDED:
--   migration_017 intentionally left `saves` with RLS DISABLED (a "legacy"
--   table read only via the service-role key on the server). But Supabase
--   Realtime will NOT push `postgres_changes` to a browser client unless:
--     1. RLS is ENABLED on the table, AND
--     2. a SELECT policy authorizes the subscriber's role (`authenticated`), AND
--     3. the table is a member of the `supabase_realtime` publication.
--   Without (1)+(2) the socket connects (SUBSCRIBED) but receives 0 events.
--
-- SAFETY:
--   - Server reads use the service-role key, which BYPASSES RLS → unaffected.
--   - The browser anon client never SELECTs `saves` directly (it only
--     subscribes to Realtime), so the new policy doesn't gate any real query.
--   - Policy is `to authenticated` (NOT anon), so the public anon key cannot
--     read saves rows via PostgREST.
--
-- Apply by hand in the Supabase SQL editor (there is no migration runner).
-- ============================================================================

-- 1. Enable RLS + authenticated read policy (required for Realtime delivery).
alter table saves enable row level security;

drop policy if exists "saves_authenticated_read" on saves;
create policy "saves_authenticated_read" on saves
  for select to authenticated
  using (true);

-- 2. Add `saves` to the Realtime publication (idempotent — skip if already in).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'saves'
  ) then
    execute 'alter publication supabase_realtime add table saves';
  end if;
end$$;

-- 3. Ensure UPDATE/DELETE events carry the full old row (for completeness;
--    INSERTs from sync are the main case, but this future-proofs filters).
alter table saves replica identity full;
