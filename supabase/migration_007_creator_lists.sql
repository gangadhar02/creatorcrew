-- Migration 007 — Creator Lists (Phase 8)
-- Paste into Supabase SQL Editor → Run.

create table if not exists creator_lists (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  name            text not null,
  description     text,
  color           text default 'gray',
  position        integer default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (workspace_id, name)
);

create index if not exists creator_lists_workspace_idx on creator_lists(workspace_id);

drop trigger if exists creator_lists_updated_at on creator_lists;
create trigger creator_lists_updated_at before update on creator_lists
  for each row execute function set_updated_at();

alter table creator_lists disable row level security;

create table if not exists creator_list_members (
  list_id      uuid not null references creator_lists(id) on delete cascade,
  creator_id   uuid not null references creators(id) on delete cascade,
  added_at     timestamptz not null default now(),
  primary key (list_id, creator_id)
);

create index if not exists creator_list_members_list_idx    on creator_list_members(list_id);
create index if not exists creator_list_members_creator_idx on creator_list_members(creator_id);

alter table creator_list_members disable row level security;
