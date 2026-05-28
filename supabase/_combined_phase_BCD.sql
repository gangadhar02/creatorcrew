-- ============================================================================
-- Saves Engine — Phase B/C/D combined migrations
-- ============================================================================
-- Paste this entire file into Supabase Dashboard → SQL Editor → New query
-- → Run. Idempotent: re-running it is safe.
--
-- What this does:
--   010  Post enrichment columns (taxonomy / mood / ai_overview / mirror)
--   011  Hierarchical pillar taxonomy + workspace_pinned_pillars + seeds
--   012  Per-creator outlier baselines (Pareto-tail fit)
--   013  pgvector + tsvector hybrid Discover (incl. match_creator_posts RPC)
--   014  Voice card v0/v1 versioning + carry-forward fields
--   015  Interaction events (personalization)
--   016  Free-form canvas positions on board_items
--
-- One prerequisite: the `vector` extension must be enabled. Migration 013
-- runs `create extension if not exists vector;` which installs it on first
-- run via the SQL editor.
-- ============================================================================


-- ============================================================================
-- 010 — Post enrichment + social-mirror bookkeeping
-- ============================================================================

alter table creator_posts
  add column if not exists taxonomy_id                 text,
  add column if not exists taxonomy_label              text,
  add column if not exists taxonomy_tier1              text,
  add column if not exists content_type_label          text,
  add column if not exists media_format                text,
  add column if not exists mood                        text,
  add column if not exists ai_tags                     text[],
  add column if not exists ai_description              text,
  add column if not exists ai_overview                 jsonb,
  add column if not exists enriched_at                 timestamptz,
  add column if not exists ai_overview_generated_at    timestamptz,
  add column if not exists media_mirror                jsonb;

create index if not exists creator_posts_taxonomy_tier1_idx
  on creator_posts(taxonomy_tier1);
create index if not exists creator_posts_mood_idx
  on creator_posts(mood);
create index if not exists creator_posts_ai_tags_gin_idx
  on creator_posts using gin (ai_tags);
create index if not exists creator_posts_enriched_at_idx
  on creator_posts(enriched_at);


-- ============================================================================
-- 011 — Hierarchical pillar taxonomy (Phase C.2)
-- ============================================================================

create table if not exists pillar_taxonomy (
  taxonomy_id   text primary key,
  label         text not null,
  tier1         text not null,
  tier2         text,
  tier3         text,
  icon          text,
  color         text default 'gray',
  position      integer default 0
);

create index if not exists pillar_taxonomy_tier1_idx on pillar_taxonomy(tier1);

create table if not exists workspace_pinned_pillars (
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  taxonomy_id   text not null references pillar_taxonomy(taxonomy_id) on delete cascade,
  position      integer default 0,
  pinned_at     timestamptz not null default now(),
  primary key (workspace_id, taxonomy_id)
);

create index if not exists workspace_pinned_pillars_ws_idx
  on workspace_pinned_pillars(workspace_id);

alter table creator_lists
  add column if not exists kind text default 'curated' check (kind in ('curated', 'adaptive')),
  add column if not exists pillar_taxonomy_id text references pillar_taxonomy(taxonomy_id) on delete set null,
  add column if not exists emoji text;

insert into pillar_taxonomy (taxonomy_id, label, tier1, tier2, tier3, icon, color, position) values
  ('ext:productivity',                          'Productivity',                                'Productivity',     null, null, 'rocket',    'purple', 1),
  ('ext:self_improvement',                      'Self-improvement',                            'Self-improvement', null, null, 'sparkles',  'pink',   2),
  ('ext:business',                              'Business',                                    'Business',         null, null, 'briefcase', 'green',  3),
  ('ext:health',                                'Health & fitness',                            'Health & fitness', null, null, 'heart',     'red',    4),
  ('ext:content_creation',                      'Content creation',                            'Content creation', null, null, 'layers',    'orange', 5),
  ('ext:psychology',                            'Psychology',                                  'Psychology',       null, null, 'brain',     'blue',   6),
  ('ext:productivity__automation',              'Productivity > Automation',                   'Productivity',     'Automation',      null,         'workflow', 'purple', 10),
  ('ext:productivity__automation__ai_agents',   'Productivity > Automation > AI agents',       'Productivity',     'Automation',      'AI agents',  'rocket',   'purple', 11),
  ('ext:productivity__systems',                 'Productivity > Systems',                      'Productivity',     'Systems',         null,         'workflow', 'purple', 12),
  ('ext:productivity__time_management',         'Productivity > Time management',              'Productivity',     'Time management', null,         'rocket',   'purple', 13),
  ('ext:self_improvement__discipline',          'Self-improvement > Discipline',               'Self-improvement', 'Discipline',      null,         'sparkles', 'pink',   20),
  ('ext:self_improvement__mindset',             'Self-improvement > Mindset',                  'Self-improvement', 'Mindset',         null,         'brain',    'pink',   21),
  ('ext:self_improvement__habits',              'Self-improvement > Habits',                   'Self-improvement', 'Habits',          null,         'sparkles', 'pink',   22),
  ('ext:business__marketing',                   'Business > Marketing',                        'Business',         'Marketing',       null,         'megaphone','green',  30),
  ('ext:business__sales',                       'Business > Sales',                            'Business',         'Sales',           null,         'briefcase','green',  31),
  ('ext:business__startups',                    'Business > Startups',                         'Business',         'Startups',        null,         'rocket',   'green',  32),
  ('ext:business__finance',                     'Business > Finance',                          'Business',         'Finance',         null,         'briefcase','green',  33),
  ('ext:health__training',                      'Health & fitness > Training',                 'Health & fitness', 'Training',        null,         'heart',    'red',    40),
  ('ext:health__nutrition',                     'Health & fitness > Nutrition',                'Health & fitness', 'Nutrition',       null,         'heart',    'red',    41),
  ('ext:health__sleep',                         'Health & fitness > Sleep',                    'Health & fitness', 'Sleep',           null,         'heart',    'red',    42),
  ('ext:content_creation__short_form',          'Content creation > Short-form video',         'Content creation', 'Short-form video',null,         'layers',   'orange', 50),
  ('ext:content_creation__long_form',           'Content creation > Long-form video',          'Content creation', 'Long-form video', null,         'layers',   'orange', 51),
  ('ext:content_creation__writing',             'Content creation > Writing',                  'Content creation', 'Writing',         null,         'layers',   'orange', 52),
  ('ext:content_creation__design',              'Content creation > Design',                   'Content creation', 'Design',          null,         'palette',  'orange', 53),
  ('ext:psychology__behavior',                  'Psychology > Behavior',                       'Psychology',       'Behavior',        null,         'brain',    'blue',   60),
  ('ext:psychology__cognition',                 'Psychology > Cognition',                      'Psychology',       'Cognition',       null,         'brain',    'blue',   61)
on conflict (taxonomy_id) do nothing;


-- ============================================================================
-- 012 — Per-creator outlier baselines (Phase C.1)
-- ============================================================================

create table if not exists outlier_baselines (
  creator_id    uuid not null references creators(id) on delete cascade,
  segment_id    text not null,
  metric_label  text not null,
  tau           numeric not null,
  median        numeric not null,
  m_infinity    numeric not null,
  sample_size   integer not null default 0,
  computed_at   timestamptz not null default now(),
  primary key (creator_id, segment_id, metric_label)
);

create index if not exists outlier_baselines_creator_idx on outlier_baselines(creator_id);


-- ============================================================================
-- 013 — pgvector + tsvector hybrid Discover (Phase C.3)
-- ============================================================================

create extension if not exists vector;
create extension if not exists pg_trgm;

alter table creator_posts
  add column if not exists embedding vector(768),
  add column if not exists fts tsvector;

-- Populate fts via trigger (generated columns can't call to_tsvector since
-- the regconfig cast is STABLE, not IMMUTABLE).
create or replace function creator_posts_update_fts()
returns trigger as $$
begin
  new.fts := to_tsvector(
    'simple',
    coalesce(new.title_or_caption, '') || ' ' ||
    coalesce(new.ai_description, '') || ' ' ||
    coalesce(array_to_string(new.ai_tags, ' '), '')
  );
  return new;
end;
$$ language plpgsql;

drop trigger if exists creator_posts_fts_trigger on creator_posts;
create trigger creator_posts_fts_trigger
  before insert or update of title_or_caption, ai_description, ai_tags
  on creator_posts
  for each row execute function creator_posts_update_fts();

-- Backfill existing rows once.
update creator_posts
  set fts = to_tsvector(
    'simple',
    coalesce(title_or_caption, '') || ' ' ||
    coalesce(ai_description, '') || ' ' ||
    coalesce(array_to_string(ai_tags, ' '), '')
  )
  where fts is null;

create index if not exists creator_posts_fts_idx
  on creator_posts using gin (fts);
create index if not exists creator_posts_embedding_idx
  on creator_posts using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function match_creator_posts(
  query_embedding vector(768),
  match_count int,
  ws uuid
)
returns table (
  id uuid,
  platform text,
  platform_pk text,
  code text,
  url text,
  media_type text,
  title_or_caption text,
  like_count int,
  comment_count int,
  view_count int,
  play_count int,
  engagement_rate numeric,
  outlier_multiplier numeric,
  published_at timestamptz,
  thumbnail_url text,
  transcript text,
  vision_analysis_md text,
  pillar_id uuid,
  taxonomy_id text,
  taxonomy_label text,
  taxonomy_tier1 text,
  content_type_label text,
  media_format text,
  mood text,
  ai_tags text[],
  ai_description text,
  ai_overview jsonb,
  enriched_at timestamptz,
  creator json,
  similarity numeric
)
language sql stable as $$
  select
    p.id, p.platform, p.platform_pk, p.code, p.url, p.media_type,
    p.title_or_caption, p.like_count, p.comment_count, p.view_count,
    p.play_count, p.engagement_rate, p.outlier_multiplier, p.published_at,
    p.thumbnail_url, p.transcript, p.vision_analysis_md, p.pillar_id,
    p.taxonomy_id, p.taxonomy_label, p.taxonomy_tier1, p.content_type_label,
    p.media_format, p.mood, p.ai_tags, p.ai_description, p.ai_overview,
    p.enriched_at,
    json_build_object(
      'id', c.id, 'handle', c.handle, 'display_name', c.display_name,
      'follower_count', c.follower_count, 'avatar_url', c.avatar_url,
      'is_verified', c.is_verified, 'platform', c.platform,
      'workspace_id', c.workspace_id
    ) as creator,
    1 - (p.embedding <=> query_embedding) as similarity
  from creator_posts p
  join creators c on c.id = p.creator_id
  where c.workspace_id = ws
    and p.embedding is not null
  order by p.embedding <=> query_embedding
  limit match_count;
$$;


-- ============================================================================
-- 014 — Voice card v0/v1 versioning + carry-forward (Phase C.6)
-- ============================================================================

alter table voices
  add column if not exists version          text default 'v1',
  add column if not exists history          jsonb default '[]'::jsonb,
  add column if not exists vocabulary_list  text[],
  add column if not exists writing_samples  text[],
  add column if not exists anchor_stories   text[],
  add column if not exists format_scaffolds text[],
  add column if not exists tone_tags        text[],
  add column if not exists rhythm           text,
  add column if not exists format_habits    text,
  add column if not exists prefer           text[],
  add column if not exists avoid            text[];


-- ============================================================================
-- 015 — Interaction events for personalization (Phase C.4)
-- ============================================================================

create table if not exists post_events (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  content_id    uuid not null references creator_posts(id) on delete cascade,
  creator_id    uuid references creators(id) on delete set null,
  session_id    uuid,
  event_type    text not null,
  dwell_ms      integer,
  position      integer,
  surface       text,
  view_mode     text,
  tab           text,
  metadata      jsonb,
  occurred_at   bigint not null
);

create index if not exists post_events_ws_time_idx
  on post_events(workspace_id, occurred_at desc);
create index if not exists post_events_ws_type_idx
  on post_events(workspace_id, event_type, occurred_at desc);
create index if not exists post_events_content_idx
  on post_events(content_id);


-- ============================================================================
-- 016 — Free-form canvas positions on board_items (Phase D.1)
-- ============================================================================

alter table board_items
  add column if not exists x integer default 0,
  add column if not exists y integer default 0,
  add column if not exists w integer default 320,
  add column if not exists h integer default 400;


-- ============================================================================
-- Done. After running, verify with:
--   select count(*) from pillar_taxonomy;          -- expect 26
--   select column_name from information_schema.columns
--     where table_name='creator_posts' and column_name in
--       ('ai_overview','embedding','taxonomy_id','media_mirror');
-- ============================================================================
