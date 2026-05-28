-- Migration 010 — Post enrichment (Phase B.4)
-- Adds pre-computed taxonomy + content metadata + AI overview blocks to every
-- creator_posts row. Boost menus and Discover ranking become near-instant
-- once these columns are populated.

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
  add column if not exists ai_overview_generated_at    timestamptz;

create index if not exists creator_posts_taxonomy_tier1_idx
  on creator_posts(taxonomy_tier1);
create index if not exists creator_posts_mood_idx
  on creator_posts(mood);
create index if not exists creator_posts_ai_tags_gin_idx
  on creator_posts using gin (ai_tags);
create index if not exists creator_posts_enriched_at_idx
  on creator_posts(enriched_at);

-- ============================================================================
-- Social-mirror CDN bookkeeping (Phase B.5)
-- ============================================================================
alter table creator_posts
  add column if not exists media_mirror jsonb;

