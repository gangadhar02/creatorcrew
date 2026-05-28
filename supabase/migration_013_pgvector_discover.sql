-- Migration 013 — Hybrid Discover via pgvector + tsvector (Phase C.3)
-- Adds an embedding column + a generated tsvector for keyword search. Use
-- this instead of standing up Typesense for our personal-scale workload.

create extension if not exists vector;
create extension if not exists pg_trgm;

alter table creator_posts
  add column if not exists embedding vector(768),
  add column if not exists fts tsvector;

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
-- Approximate-nearest-neighbour index for embeddings (cosine).
create index if not exists creator_posts_embedding_idx
  on creator_posts using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ============================================================================
-- match_creator_posts — vector ANN within a workspace, joined with creators.
-- Returns a row shape compatible with the SELECT used by /api/discover-v2.
-- ============================================================================
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
