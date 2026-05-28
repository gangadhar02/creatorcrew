-- Migration 006 — Discover feed (Phase 7)
-- Paste into Supabase SQL Editor → Run.

-- ============================================================================
-- pillars: user-defined content category chips
-- ============================================================================
create table if not exists pillars (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  name            text not null,
  color           text default 'gray',
  position        integer default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (workspace_id, name)
);

create index if not exists pillars_workspace_idx on pillars(workspace_id);

drop trigger if exists pillars_updated_at on pillars;
create trigger pillars_updated_at before update on pillars
  for each row execute function set_updated_at();

alter table pillars disable row level security;

-- Add the FK from creator_posts.pillar_id → pillars.id (the column already
-- exists from migration 005 but without a FK constraint).
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'creator_posts_pillar_id_fkey'
  ) then
    alter table creator_posts
      add constraint creator_posts_pillar_id_fkey
      foreign key (pillar_id) references pillars(id) on delete set null;
  end if;
end $$;

-- ============================================================================
-- post_seen: powers hide-seen on Discover
-- ============================================================================
create table if not exists post_seen (
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  post_id         uuid not null references creator_posts(id) on delete cascade,
  viewed_at       timestamptz not null default now(),
  primary key (workspace_id, post_id)
);

create index if not exists post_seen_workspace_idx on post_seen(workspace_id);
create index if not exists post_seen_viewed_idx    on post_seen(viewed_at desc);

alter table post_seen disable row level security;

-- ============================================================================
-- Seed: a starter set of pillars matching the AI Creatives audience.
-- Idempotent.
-- ============================================================================
insert into pillars (workspace_id, name, color, position)
select w.id, n.name, n.color, n.position
from workspaces w
cross join (values
  ('Teach',     'blue',   1),
  ('Showcase',  'purple', 2),
  ('Tools',     'orange', 3),
  ('Process',   'green',  4),
  ('Trends',    'pink',   5)
) as n(name, color, position)
on conflict (workspace_id, name) do nothing;
