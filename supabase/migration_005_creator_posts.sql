-- Migration 005 — Cross-platform unification (Phase 6)
-- Paste into Supabase SQL Editor → Run.
--
-- Adds `creators` + `creator_posts` as the new source of truth for any post
-- on any platform. Migrates `profiles` → `creators` and `profile_posts` +
-- `saves` content → `creator_posts`. Adds `creator_post_id` link to `saves`
-- without dropping its existing columns (those become redundant denormalized
-- copies that the webapp + sync.py will stop writing in their refactor;
-- a future migration drops them once cutover is verified).
--
-- Creates `saves_compat` and `profile_posts_compat` views so any code still
-- reading the old shape keeps working through the cutover.
--
-- Idempotent: re-running won't duplicate rows thanks to ON CONFLICT guards.

-- ============================================================================
-- creators
-- ============================================================================
create table if not exists creators (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references workspaces(id) on delete cascade,
  platform              text not null check (platform in
                          ('instagram','youtube','linkedin','substack','x','tiktok')),
  handle                text not null,
  display_name          text,
  bio                   text,
  follower_count        integer,
  following_count       integer,
  post_count            integer,
  avatar_url            text,
  is_verified           boolean default false,
  ig_user_id            text,
  typical_reel_views    integer,
  typical_post_likes    integer,
  last_synced_at        timestamptz,
  sync_status           text default 'idle' check (sync_status in ('idle','syncing','failed')),
  sync_error            text,
  raw_profile_json      jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (workspace_id, platform, handle)
);

create index if not exists creators_workspace_idx on creators(workspace_id);
create index if not exists creators_platform_handle_idx on creators(platform, handle);

drop trigger if exists creators_updated_at on creators;
create trigger creators_updated_at before update on creators
  for each row execute function set_updated_at();

alter table creators disable row level security;

-- ============================================================================
-- creator_posts
-- ============================================================================
create table if not exists creator_posts (
  id                    uuid primary key default gen_random_uuid(),
  creator_id            uuid references creators(id) on delete cascade,
  platform              text not null check (platform in
                          ('instagram','youtube','linkedin','substack','x','tiktok')),
  platform_pk           text not null,
  code                  text,
  url                   text not null,
  media_type            text,
  title_or_caption      text,
  transcript            text,
  vision_analysis_md    text,
  vision_analyzed_at    timestamptz,
  like_count            integer default 0,
  comment_count         integer default 0,
  view_count            integer default 0,
  play_count            integer default 0,
  share_count           integer default 0,
  engagement_rate       numeric(6, 2),
  outlier_multiplier    numeric(6, 2),
  published_at          timestamptz,
  thumbnail_url         text,
  raw_json              jsonb,
  pillar_id             uuid,
  pillar_confidence     numeric(4, 2),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (platform, platform_pk)
);

create index if not exists creator_posts_creator_idx       on creator_posts(creator_id);
create index if not exists creator_posts_platform_idx      on creator_posts(platform);
create index if not exists creator_posts_published_idx     on creator_posts(published_at desc);
create index if not exists creator_posts_outlier_idx       on creator_posts(outlier_multiplier desc);
create index if not exists creator_posts_view_count_idx    on creator_posts(view_count desc);
create index if not exists creator_posts_like_count_idx    on creator_posts(like_count desc);
create index if not exists creator_posts_pillar_idx        on creator_posts(pillar_id);

drop trigger if exists creator_posts_updated_at on creator_posts;
create trigger creator_posts_updated_at before update on creator_posts
  for each row execute function set_updated_at();

alter table creator_posts disable row level security;

-- ============================================================================
-- DATA MIGRATION
-- ============================================================================

-- 1. Migrate `profiles` → `creators` (platform = 'instagram')
do $$
declare
  ws_id uuid;
begin
  select id into ws_id from workspaces order by created_at asc limit 1;
  if ws_id is null then
    raise exception 'No workspace found — apply migration 003 first';
  end if;

  insert into creators (
    workspace_id, platform, handle, display_name, bio, follower_count,
    following_count, post_count, avatar_url, is_verified, ig_user_id,
    typical_reel_views, typical_post_likes, last_synced_at, sync_status,
    sync_error, created_at, updated_at
  )
  select
    ws_id,
    'instagram',
    p.ig_handle,
    p.display_name,
    p.bio,
    p.follower_count,
    p.following_count,
    p.post_count,
    p.profile_pic_url,
    coalesce(p.is_verified, false),
    p.ig_user_id,
    p.typical_reel_views,
    p.typical_post_likes,
    p.last_synced_at,
    coalesce(p.sync_status, 'idle'),
    p.sync_error,
    p.created_at,
    p.updated_at
  from profiles p
  on conflict (workspace_id, platform, handle) do nothing;
end $$;

-- 2. Migrate `profile_posts` → `creator_posts`
insert into creator_posts (
  creator_id, platform, platform_pk, code, url, media_type, title_or_caption,
  transcript, vision_analysis_md, like_count, comment_count, view_count,
  play_count, engagement_rate, outlier_multiplier, published_at,
  thumbnail_url, raw_json, created_at, updated_at
)
select
  c.id,
  'instagram',
  pp.media_pk,
  pp.code,
  pp.url,
  pp.type,
  pp.caption,
  pp.transcript,
  pp.vision_analysis_md,
  coalesce(pp.like_count, 0),
  coalesce(pp.comment_count, 0),
  coalesce(pp.view_count, 0),
  coalesce(pp.play_count, 0),
  pp.engagement_rate,
  pp.outlier_multiplier,
  pp.taken_at,
  pp.thumbnail_url,
  pp.ig_raw_json,
  pp.created_at,
  pp.updated_at
from profile_posts pp
join profiles p on p.id = pp.profile_id
join creators c on c.platform = 'instagram' and c.handle = p.ig_handle
on conflict (platform, platform_pk) do nothing;

-- 3. Create phantom `creators` rows for `saves.author` values not already
--    in `creators` (so each save row can be linked to a creator).
do $$
declare
  ws_id uuid;
begin
  select id into ws_id from workspaces order by created_at asc limit 1;

  insert into creators (workspace_id, platform, handle)
  select distinct ws_id, 'instagram', s.author
  from saves s
  where s.author is not null and s.author <> ''
    and not exists (
      select 1 from creators c
      where c.workspace_id = ws_id
        and c.platform = 'instagram'
        and c.handle = s.author
    )
  on conflict (workspace_id, platform, handle) do nothing;
end $$;

-- 4. Migrate `saves` content → `creator_posts` (rows that aren't already
--    present from profile_posts).
insert into creator_posts (
  creator_id, platform, platform_pk, code, url, media_type, title_or_caption,
  vision_analysis_md, vision_analyzed_at, raw_json, created_at, updated_at
)
select
  c.id,
  'instagram',
  s.media_pk,
  s.code,
  s.url,
  s.type,
  s.caption,
  s.vision_analysis_md,
  s.vision_analyzed_at,
  s.ig_raw_json,
  s.created_at,
  s.updated_at
from saves s
left join creators c on c.platform = 'instagram' and c.handle = s.author
on conflict (platform, platform_pk) do nothing;

-- 5. Add the link column to `saves` and backfill it.
alter table saves
  add column if not exists creator_post_id uuid references creator_posts(id);

update saves s
set creator_post_id = cp.id
from creator_posts cp
where cp.platform = 'instagram'
  and cp.platform_pk = s.media_pk
  and s.creator_post_id is null;

create index if not exists saves_creator_post_idx on saves(creator_post_id);

-- ============================================================================
-- Compat views (legacy shapes for any code not yet migrated)
-- ============================================================================
create or replace view saves_compat as
  select
    s.id,
    s.media_pk,
    s.code,
    s.url,
    s.type,
    s.author,
    s.caption,
    s.collection_name,
    s.status,
    s.saved_at,
    s.vision_analysis_md,
    s.vision_analyzed_at,
    s.ig_raw_json,
    s.notes_md,
    s.creator_post_id,
    s.created_at,
    s.updated_at
  from saves s;

create or replace view profile_posts_compat as
  select
    cp.id,
    cp.creator_id as profile_id,
    cp.platform_pk as media_pk,
    cp.code,
    cp.url,
    cp.media_type as type,
    cp.title_or_caption as caption,
    cp.like_count,
    cp.comment_count,
    cp.view_count,
    cp.play_count,
    cp.published_at as taken_at,
    cp.thumbnail_url,
    cp.transcript,
    cp.vision_analysis_md,
    cp.engagement_rate,
    cp.outlier_multiplier,
    cp.raw_json as ig_raw_json,
    cp.created_at,
    cp.updated_at
  from creator_posts cp
  where cp.platform = 'instagram';
