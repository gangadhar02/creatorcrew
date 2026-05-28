-- Instagram Saves Engine — Supabase schema
-- Run this once against a fresh Supabase project (Settings → SQL editor → paste → Run)
-- or via psql with the connection string from Project Settings → Database.

-- ============================================================================
-- Extensions
-- ============================================================================
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ============================================================================
-- updated_at trigger helper
-- ============================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- saves: one row per Instagram saved post
-- ============================================================================
create table if not exists saves (
  id                   uuid primary key default gen_random_uuid(),
  media_pk             text unique not null,          -- IG media primary key (the dedup key)
  code                 text,                          -- IG short code
  url                  text not null,
  type                 text not null check (type in ('Post', 'Reel', 'Carousel', 'IGTV')),
  author               text,
  caption              text,
  collection_name      text,
  status               text not null default 'New'
                       check (status in ('New', 'Reviewed', 'Used')),
  saved_at             timestamptz not null default now(),
  vision_analysis_md   text,                          -- Gemini markdown analysis
  vision_analyzed_at   timestamptz,
  ig_raw_json          jsonb,                         -- raw IG response for re-analysis
  notes_md             text,                          -- user-editable freeform notes (TipTap)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists saves_status_idx     on saves(status);
create index if not exists saves_collection_idx on saves(collection_name);
create index if not exists saves_saved_at_idx   on saves(saved_at desc);
create index if not exists saves_type_idx       on saves(type);

drop trigger if exists saves_updated_at on saves;
create trigger saves_updated_at before update on saves
  for each row execute function set_updated_at();

-- ============================================================================
-- content_ideas: generated ideas, linked to source saves
-- ============================================================================
create table if not exists content_ideas (
  id                   uuid primary key default gen_random_uuid(),
  save_id              uuid references saves(id) on delete set null,
  name                 text not null,
  pillar               text,                          -- Teach / Showcase / Tools / Process / Trends
  priority             text check (priority in ('High', 'Medium', 'Low')),
  format               text,                          -- Carousel / Reel / Short Video / Long-form Video
  platforms            text[],                        -- ['Instagram', 'X', 'YouTube']
  angle                text,
  hook_curiosity       text,
  hook_value           text,
  hook_emotional       text,
  outline_md           text,
  ig_breakdown_md      text,
  x_breakdown_md       text,
  youtube_breakdown_md text,
  body_md              text,                          -- catch-all for TipTap-edited notes
  week_of              date,
  status               text not null default 'Not started'
                       check (status in ('Not started', 'In progress', 'Done')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists content_ideas_status_idx  on content_ideas(status);
create index if not exists content_ideas_week_idx    on content_ideas(week_of);
create index if not exists content_ideas_pillar_idx  on content_ideas(pillar);
create index if not exists content_ideas_save_idx    on content_ideas(save_id);

drop trigger if exists content_ideas_updated_at on content_ideas;
create trigger content_ideas_updated_at before update on content_ideas
  for each row execute function set_updated_at();

-- ============================================================================
-- profiles: IG profile analyses (new feature — paste a handle, get a breakdown)
-- ============================================================================
create table if not exists profiles (
  id                       uuid primary key default gen_random_uuid(),
  ig_handle                text unique not null,
  display_name             text,
  bio                      text,
  follower_count           integer,
  following_count          integer,
  post_count               integer,
  analyzed_at              timestamptz not null default now(),
  content_type_breakdown   jsonb,                     -- {"Reel": 60, "Carousel": 30, "Image": 10}
  hook_patterns            text[],                    -- discovered hook patterns
  themes                   text[],
  posting_cadence          text,
  visual_style_md          text,
  raw_analysis_md          text,                      -- full Gemini analysis
  sample_post_ids          text[],                    -- IG pks of posts sampled
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists profiles_handle_idx on profiles(ig_handle);

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- ============================================================================
-- sync_runs: log of each sync.py execution (for the webapp dashboard)
-- ============================================================================
create table if not exists sync_runs (
  id              uuid primary key default gen_random_uuid(),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  status          text check (status in ('running', 'completed', 'failed')),
  new_count       integer default 0,
  skipped_count   integer default 0,
  total_count     integer default 0,
  vision_ok       integer default 0,
  vision_err      integer default 0,
  error_message   text,
  log_excerpt     text
);

create index if not exists sync_runs_started_idx on sync_runs(started_at desc);

-- ============================================================================
-- Row Level Security: disabled for personal/local use.
-- All access uses the service_role key (server-side) or anon key with
-- service_role-equivalent grants. Enable RLS if this ever leaves your machine.
-- ============================================================================
alter table saves          disable row level security;
alter table content_ideas  disable row level security;
alter table profiles       disable row level security;
alter table sync_runs      disable row level security;
