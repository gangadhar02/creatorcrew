-- Migration 017 — Auth ownership + RLS  (REVISED)
--
-- Goal: tie every workspace-scoped row to an auth.users.id and lock down
-- the database with row-level security policies so users can only see their
-- own workspace's data. The Next.js app still uses the service role key
-- server-side (which bypasses RLS), so this is defense-in-depth — if any
-- query forgets to filter by workspace_id, or if we ever expose the anon
-- key to the client, RLS catches the leak.
--
-- Apply order: paste into Supabase SQL editor, run once. Idempotent on
-- re-run (uses `if not exists` and `drop policy if exists`).
--
-- ============================================================================
-- Table ownership map (verified against migrations 001–016)
-- ----------------------------------------------------------------------------
-- DIRECT workspace_id column:
--   creators · creator_lists · boards · cards · documents · files · chats ·
--   voices · post_seen · post_events · pillars · workspace_pinned_pillars ·
--   onboarding_progress · bookmark_items
--
-- JOIN through a parent:
--   creator_posts            → creators.workspace_id   (creator_id FK)
--   board_items              → boards.workspace_id     (board_id FK)
--   chat_messages            → chats.workspace_id      (chat_id FK)
--   creator_list_members     → creator_lists.workspace_id (list_id FK)
--   outlier_baselines        → creators.workspace_id   (creator_id FK)
--
-- LEGACY (no workspace concept — RLS left disabled, service-role only):
--   saves · profile_posts · content_ideas · profiles · sync_runs
-- ============================================================================

-- ============================================================================
-- 1. Add ownership column to workspaces
-- ============================================================================
alter table workspaces
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;

create unique index if not exists workspaces_owner_user_id_unique
  on workspaces (owner_user_id)
  where owner_user_id is not null;

create index if not exists workspaces_owner_email_idx
  on workspaces (owner_email);

-- Re-key the existing personal workspace to the user's gmail so they can
-- claim it on first sign-in. (The seed had ads@demandlane.com from the
-- pre-auth single-tenant days.) Safe to run when the email is already set.
update workspaces
  set owner_email = 'sgangadhar.exe@gmail.com'
  where owner_email = 'ads@demandlane.com'
    and owner_user_id is null;

-- ============================================================================
-- 2. Helper function: is_workspace_owner(uuid)
-- ============================================================================
-- Returns true if the calling user owns the given workspace. SECURITY DEFINER
-- so policy checks don't recurse into the workspaces table's own RLS.
create or replace function public.is_workspace_owner(ws uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from workspaces
    where id = ws and owner_user_id = auth.uid()
  );
$$;

grant execute on function public.is_workspace_owner(uuid) to authenticated, anon;

-- ============================================================================
-- 3. Direct workspace_id tables — single helper macro via DO block
-- ============================================================================
do $rls$
declare
  tbl text;
  -- ONLY tables that have a workspace_id column directly.
  direct_tables text[] := array[
    'creators',
    'creator_lists',
    'boards',
    'cards',
    'documents',
    'files',
    'chats',
    'voices',
    'post_seen',
    'post_events',
    'pillars',
    'workspace_pinned_pillars',
    'onboarding_progress',
    'bookmark_items'
  ];
begin
  foreach tbl in array direct_tables loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;
    -- Skip if the table somehow lacks workspace_id (defensive — shouldn't
    -- happen for these tables but guards against partial schemas).
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = tbl
        and column_name = 'workspace_id'
    ) then
      raise notice 'Skipping %: no workspace_id column', tbl;
      continue;
    end if;
    execute format('alter table %I enable row level security', tbl);
    execute format('drop policy if exists %I on %I', 'ws_owner_all_' || tbl, tbl);
    execute format(
      'create policy %I on %I for all to authenticated using (is_workspace_owner(workspace_id)) with check (is_workspace_owner(workspace_id))',
      'ws_owner_all_' || tbl, tbl
    );
  end loop;
end
$rls$;

-- ============================================================================
-- 4. workspaces table — special case (key is owner_user_id, not workspace_id)
-- ============================================================================
alter table workspaces enable row level security;
drop policy if exists "ws_owner_select"     on workspaces;
drop policy if exists "ws_owner_update"     on workspaces;
drop policy if exists "ws_owner_insert"     on workspaces;
drop policy if exists "ws_unclaimed_select" on workspaces;
drop policy if exists "ws_unclaimed_update" on workspaces;

create policy "ws_owner_select" on workspaces for select to authenticated
  using (owner_user_id = auth.uid());
create policy "ws_owner_update" on workspaces for update to authenticated
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "ws_owner_insert" on workspaces for insert to authenticated
  with check (owner_user_id = auth.uid());

-- Lets an authenticated user SEE + CLAIM a workspace whose owner_email
-- matches their own email and is not yet linked to a user. Used once on
-- first sign-in to adopt the legacy single-tenant workspace.
create policy "ws_unclaimed_select" on workspaces for select to authenticated
  using (
    owner_user_id is null
    and owner_email = (select email from auth.users where id = auth.uid())
  );
create policy "ws_unclaimed_update" on workspaces for update to authenticated
  using (
    owner_user_id is null
    and owner_email = (select email from auth.users where id = auth.uid())
  )
  with check (owner_user_id = auth.uid());

-- ============================================================================
-- 5. Joined-through-parent tables — each gets a custom policy
-- ============================================================================

-- creator_posts → creators.workspace_id
do $$
begin
  if to_regclass('public.creator_posts') is not null then
    alter table creator_posts enable row level security;
    drop policy if exists "ws_owner_all_creator_posts" on creator_posts;
    create policy "ws_owner_all_creator_posts" on creator_posts for all to authenticated
      using (
        exists (
          select 1 from creators c
          where c.id = creator_posts.creator_id
            and is_workspace_owner(c.workspace_id)
        )
      )
      with check (
        exists (
          select 1 from creators c
          where c.id = creator_posts.creator_id
            and is_workspace_owner(c.workspace_id)
        )
      );
  end if;
end$$;

-- board_items → boards.workspace_id (template boards have workspace_id=null
-- and are readable by everyone via the boards_template_read policy)
do $$
begin
  if to_regclass('public.board_items') is not null then
    alter table board_items enable row level security;
    drop policy if exists "ws_owner_all_board_items" on board_items;
    create policy "ws_owner_all_board_items" on board_items for all to authenticated
      using (
        exists (
          select 1 from boards b
          where b.id = board_items.board_id
            and (b.workspace_id is null or is_workspace_owner(b.workspace_id))
        )
      )
      with check (
        exists (
          select 1 from boards b
          where b.id = board_items.board_id
            and is_workspace_owner(b.workspace_id)
        )
      );
  end if;
end$$;

-- chat_messages → chats.workspace_id
do $$
begin
  if to_regclass('public.chat_messages') is not null then
    alter table chat_messages enable row level security;
    drop policy if exists "ws_owner_all_chat_messages" on chat_messages;
    create policy "ws_owner_all_chat_messages" on chat_messages for all to authenticated
      using (
        exists (
          select 1 from chats c
          where c.id = chat_messages.chat_id
            and is_workspace_owner(c.workspace_id)
        )
      )
      with check (
        exists (
          select 1 from chats c
          where c.id = chat_messages.chat_id
            and is_workspace_owner(c.workspace_id)
        )
      );
  end if;
end$$;

-- creator_list_members → creator_lists.workspace_id
do $$
begin
  if to_regclass('public.creator_list_members') is not null then
    alter table creator_list_members enable row level security;
    drop policy if exists "ws_owner_all_creator_list_members" on creator_list_members;
    create policy "ws_owner_all_creator_list_members" on creator_list_members for all to authenticated
      using (
        exists (
          select 1 from creator_lists l
          where l.id = creator_list_members.list_id
            and is_workspace_owner(l.workspace_id)
        )
      )
      with check (
        exists (
          select 1 from creator_lists l
          where l.id = creator_list_members.list_id
            and is_workspace_owner(l.workspace_id)
        )
      );
  end if;
end$$;

-- outlier_baselines → creators.workspace_id
do $$
begin
  if to_regclass('public.outlier_baselines') is not null then
    alter table outlier_baselines enable row level security;
    drop policy if exists "ws_owner_all_outlier_baselines" on outlier_baselines;
    create policy "ws_owner_all_outlier_baselines" on outlier_baselines for all to authenticated
      using (
        exists (
          select 1 from creators c
          where c.id = outlier_baselines.creator_id
            and is_workspace_owner(c.workspace_id)
        )
      )
      with check (
        exists (
          select 1 from creators c
          where c.id = outlier_baselines.creator_id
            and is_workspace_owner(c.workspace_id)
        )
      );
  end if;
end$$;

-- ============================================================================
-- 6. Global read-only catalogs — readable by every authenticated user
-- ============================================================================
do $$
begin
  if to_regclass('public.pillar_taxonomy') is not null then
    alter table pillar_taxonomy enable row level security;
    drop policy if exists "pillar_taxonomy_read_all" on pillar_taxonomy;
    create policy "pillar_taxonomy_read_all" on pillar_taxonomy for select to authenticated
      using (true);
  end if;
end$$;

-- Template boards (workspace_id is null) — readable by all authenticated
-- users so starter templates show up for new sign-ups.
do $$
begin
  if to_regclass('public.boards') is not null then
    drop policy if exists "boards_template_read" on boards;
    create policy "boards_template_read" on boards for select to authenticated
      using (workspace_id is null);
  end if;
end$$;

-- ============================================================================
-- 7. Legacy tables (no workspace concept) — left with RLS disabled.
--    Service-role keys bypass RLS, so the webapp keeps working. These hold
--    Phase 1–4 data that pre-dates the workspace model:
--      saves · profile_posts · content_ideas · profiles · sync_runs
--    If you ever need to multi-tenant these, add a workspace_id column +
--    backfill, then add policies in a follow-up migration.
-- ============================================================================
