-- Migration 012 — Per-creator outlier baselines (Phase C.1)
-- Generalized-Pareto-tail parameters per (creator, segment, metric).

create table if not exists outlier_baselines (
  creator_id    uuid not null references creators(id) on delete cascade,
  segment_id    text not null,                       -- 'reel' | 'post' | 'video' | 'default'
  metric_label  text not null,                       -- 'views' | 'likes'
  tau           numeric not null,                    -- threshold quantile (top 1-tau)
  median        numeric not null,
  m_infinity    numeric not null,
  sample_size   integer not null default 0,
  computed_at   timestamptz not null default now(),
  primary key (creator_id, segment_id, metric_label)
);

create index if not exists outlier_baselines_creator_idx on outlier_baselines(creator_id);
