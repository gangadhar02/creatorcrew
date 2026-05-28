-- Bookmarks canvas — run once in Supabase SQL editor
create table if not exists bookmark_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'x')),
  external_id text not null,
  url text not null,
  author_handle text,
  author_name text,
  caption text,
  thumbnail_url text,
  media_type text,
  saved_at timestamptz,
  tags text[] not null default '{}',
  notes_md text not null default '',
  x integer not null default 0,
  y integer not null default 0,
  w integer not null default 300,
  raw_json jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, platform, external_id)
);

create index if not exists bookmark_items_workspace_idx
  on bookmark_items (workspace_id);

create index if not exists bookmark_items_tags_gin
  on bookmark_items using gin (tags);
