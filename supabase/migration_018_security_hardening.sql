-- Migration 018 — Security hardening (Supabase database linter cleanup)
--
-- Addresses the warnings shown by Supabase's database linter after
-- migration 017 enabled RLS:
--   1. ERROR: security_definer_view on saves_compat + profile_posts_compat
--      → switch to security_invoker so RLS of the *caller* applies
--   2. WARN: function_search_path_mutable on 3 functions
--      → pin search_path to prevent schema-shadow attacks
--   3. WARN: anon role can execute is_workspace_owner via RPC
--      → revoke from anon (it returns false anyway for unauthenticated)
--
-- Skipped intentionally (with rationale):
--   - extension_in_public (vector, pg_trgm): moving extensions mid-deploy is
--     fragile and breaks every existing query that references them
--     unqualified (which is most of them). Cosmetic warning.
--   - auth_leaked_password_protection: we use magic-link auth only — no
--     passwords ever exist in the system.

-- ============================================================================
-- 1. Switch SECURITY DEFINER views to SECURITY INVOKER
-- ============================================================================
do $$
begin
  if to_regclass('public.saves_compat') is not null then
    execute 'alter view public.saves_compat set (security_invoker = on)';
  end if;
  if to_regclass('public.profile_posts_compat') is not null then
    execute 'alter view public.profile_posts_compat set (security_invoker = on)';
  end if;
end$$;

-- ============================================================================
-- 2. Pin search_path on functions flagged as mutable
-- ============================================================================
-- creator_posts_update_fts: trigger function from migration 013
alter function public.creator_posts_update_fts()
  set search_path = public, pg_catalog;

-- match_creator_posts: RPC for vector ANN search (from migration 013)
alter function public.match_creator_posts(vector, int, uuid)
  set search_path = public, pg_catalog;

-- set_updated_at: generic trigger function used everywhere
alter function public.set_updated_at()
  set search_path = public, pg_catalog;

-- is_workspace_owner is already SET search_path in migration 017, but
-- re-apply here for idempotency in case 017 was modified.
alter function public.is_workspace_owner(uuid)
  set search_path = public, pg_catalog;

-- ============================================================================
-- 3. Tighten EXECUTE grants on is_workspace_owner
-- ============================================================================
-- Anon can't get a useful answer from this function (returns false when
-- auth.uid() is null), and there's no reason to expose it via /rpc. Keep
-- grant for authenticated since our RLS policies reference it.
revoke execute on function public.is_workspace_owner(uuid) from anon;
revoke execute on function public.is_workspace_owner(uuid) from public;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
