-- Migration 002 — Profile Analyzer (Eden-style)
-- Run in Supabase SQL Editor → New query → Paste → Run

-- ============================================================================
-- Extend `profiles` table with caching/sync metadata
-- ============================================================================
alter table profiles
  add column if not exists profile_pic_url      text,
  add column if not exists is_verified          boolean default false,
  add column if not exists typical_reel_views   integer,
  add column if not exists typical_post_likes   integer,
  add column if not exists last_synced_at       timestamptz,
  add column if not exists sync_status          text default 'idle'
                          check (sync_status in ('idle', 'syncing', 'failed')),
  add column if not exists sync_error           text,
  add column if not exists ig_user_id           text;

-- ============================================================================
-- profile_posts: cached posts for analyzed profiles
-- ============================================================================
create table if not exists profile_posts (
  id                   uuid primary key default gen_random_uuid(),
  profile_id           uuid not null references profiles(id) on delete cascade,
  media_pk             text not null,
  code                 text,
  url                  text not null,
  type                 text not null check (type in ('Post', 'Reel', 'Carousel', 'IGTV')),
  caption              text,
  like_count           integer default 0,
  comment_count        integer default 0,
  view_count           integer default 0,
  play_count           integer default 0,
  taken_at             timestamptz,
  thumbnail_url        text,
  transcript           text,
  vision_analysis_md   text,
  engagement_rate      numeric(6, 2),       -- percentage, e.g. 13.60
  outlier_multiplier   numeric(6, 2),       -- e.g. 5.75 means 5.75× typical
  ig_raw_json          jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique(profile_id, media_pk)
);

create index if not exists profile_posts_profile_idx          on profile_posts(profile_id);
create index if not exists profile_posts_type_idx             on profile_posts(type);
create index if not exists profile_posts_taken_at_idx         on profile_posts(taken_at desc);
create index if not exists profile_posts_like_count_idx       on profile_posts(like_count desc);
create index if not exists profile_posts_view_count_idx       on profile_posts(view_count desc);
create index if not exists profile_posts_outlier_idx          on profile_posts(outlier_multiplier desc);

drop trigger if exists profile_posts_updated_at on profile_posts;
create trigger profile_posts_updated_at before update on profile_posts
  for each row execute function set_updated_at();

alter table profile_posts disable row level security;
