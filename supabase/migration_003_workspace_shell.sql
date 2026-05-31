-- Migration 003 — Workspace shell + onboarding progress (Eden pivot, Phase 4.5)
-- Paste into Supabase SQL Editor → Run.
--
-- Adds a foundational `workspaces` table that every future Eden table will
-- reference. Backfills a single workspace for the existing user so all
-- current data has an owner once Phase 6 wires it in.
--
-- Also creates `onboarding_progress` powering the Getting Started checklist.

-- ============================================================================
-- workspaces
-- ============================================================================
create table if not exists workspaces (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  owner_email     text,                              -- soft owner key; no auth yet
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists workspaces_updated_at on workspaces;
create trigger workspaces_updated_at before update on workspaces
  for each row execute function set_updated_at();

-- Seed the default workspace for the current user. Idempotent.
-- Replace 'owner@example.com' with the email you sign in with so you can
-- claim this workspace on first sign-in (see migration 017).
insert into workspaces (id, name, owner_email)
select gen_random_uuid(), 'My workspace', 'owner@example.com'
where not exists (select 1 from workspaces);

-- ============================================================================
-- onboarding_progress
-- ============================================================================
-- task_key values (matched in webapp):
--   build_voice              — first voice created in Phase 5
--   create_board             — first board created in Phase 9
--   use_boost                — first boost run from Discover in Phase 7
--   add_creator_to_list      — first creator added to a list in Phase 8
create table if not exists onboarding_progress (
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  task_key        text not null check (task_key in (
                    'build_voice','create_board','use_boost','add_creator_to_list'
                  )),
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (workspace_id, task_key)
);

drop trigger if exists onboarding_progress_updated_at on onboarding_progress;
create trigger onboarding_progress_updated_at before update on onboarding_progress
  for each row execute function set_updated_at();

-- Seed 4 incomplete rows for the existing workspace so Home renders 0/4 cleanly.
insert into onboarding_progress (workspace_id, task_key)
select w.id, t.task_key
from workspaces w
cross join (values ('build_voice'), ('create_board'), ('use_boost'), ('add_creator_to_list')) as t(task_key)
on conflict do nothing;

-- RLS off for personal/local use, like the rest of the schema.
alter table workspaces           disable row level security;
alter table onboarding_progress  disable row level security;
