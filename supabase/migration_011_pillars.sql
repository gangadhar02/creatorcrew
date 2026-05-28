-- Migration 011 — Hierarchical pillar taxonomy (Phase C.2)
-- Mirrors Eden's ext:tier1__tier2__tier3 IDs. Workspaces pin pillars,
-- which spawns an adaptive "For you" creator_list.

create table if not exists pillar_taxonomy (
  taxonomy_id   text primary key,                    -- ext:tier1__tier2__tier3
  label         text not null,                       -- 'Productivity › Automation › AI agents'
  tier1         text not null,
  tier2         text,
  tier3         text,
  icon          text,                                -- lucide name
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

-- Extend creator_lists with kind + taxonomy + emoji so the adaptive 'For you'
-- list can live alongside curated user lists.
alter table creator_lists
  add column if not exists kind text default 'curated' check (kind in ('curated', 'adaptive')),
  add column if not exists pillar_taxonomy_id text references pillar_taxonomy(taxonomy_id) on delete set null,
  add column if not exists emoji text;

-- ============================================================================
-- Seed: 6 tier-1 pillars + a starter set of tier-2 / tier-3 children.
-- ============================================================================
insert into pillar_taxonomy (taxonomy_id, label, tier1, tier2, tier3, icon, color, position) values
  -- tier 1
  ('ext:productivity',                      'Productivity',                       'Productivity',     null, null, 'rocket',         'purple', 1),
  ('ext:self_improvement',                  'Self-improvement',                   'Self-improvement', null, null, 'sparkles',       'pink',   2),
  ('ext:business',                          'Business',                           'Business',         null, null, 'briefcase',      'green',  3),
  ('ext:health',                            'Health & fitness',                   'Health & fitness', null, null, 'heart',          'red',    4),
  ('ext:content_creation',                  'Content creation',                   'Content creation', null, null, 'layers',         'orange', 5),
  ('ext:psychology',                        'Psychology',                         'Psychology',       null, null, 'brain',          'blue',   6),

  -- tier 2 / 3
  ('ext:productivity__automation',          'Productivity › Automation',          'Productivity', 'Automation',   null,        'workflow',  'purple', 10),
  ('ext:productivity__automation__ai_agents', 'Productivity › Automation › AI agents', 'Productivity', 'Automation', 'AI agents', 'rocket', 'purple', 11),
  ('ext:productivity__systems',             'Productivity › Systems',             'Productivity', 'Systems',      null,        'workflow',  'purple', 12),
  ('ext:productivity__time_management',     'Productivity › Time management',     'Productivity', 'Time management', null,     'rocket',    'purple', 13),

  ('ext:self_improvement__discipline',      'Self-improvement › Discipline',      'Self-improvement', 'Discipline', null,      'sparkles',   'pink', 20),
  ('ext:self_improvement__mindset',         'Self-improvement › Mindset',         'Self-improvement', 'Mindset',    null,      'brain',      'pink', 21),
  ('ext:self_improvement__habits',          'Self-improvement › Habits',          'Self-improvement', 'Habits',     null,      'sparkles',   'pink', 22),

  ('ext:business__marketing',               'Business › Marketing',               'Business', 'Marketing',   null,             'megaphone',  'green', 30),
  ('ext:business__sales',                   'Business › Sales',                   'Business', 'Sales',       null,             'briefcase',  'green', 31),
  ('ext:business__startups',                'Business › Startups',                'Business', 'Startups',    null,             'rocket',     'green', 32),
  ('ext:business__finance',                 'Business › Finance',                 'Business', 'Finance',     null,             'briefcase',  'green', 33),

  ('ext:health__training',                  'Health & fitness › Training',        'Health & fitness', 'Training',  null,       'heart',      'red',  40),
  ('ext:health__nutrition',                 'Health & fitness › Nutrition',       'Health & fitness', 'Nutrition', null,       'heart',      'red',  41),
  ('ext:health__sleep',                     'Health & fitness › Sleep',           'Health & fitness', 'Sleep',     null,       'heart',      'red',  42),

  ('ext:content_creation__short_form',      'Content creation › Short-form video', 'Content creation', 'Short-form video', null, 'layers',  'orange', 50),
  ('ext:content_creation__long_form',       'Content creation › Long-form video',  'Content creation', 'Long-form video',  null, 'layers',  'orange', 51),
  ('ext:content_creation__writing',         'Content creation › Writing',          'Content creation', 'Writing',          null, 'layers',  'orange', 52),
  ('ext:content_creation__design',          'Content creation › Design',           'Content creation', 'Design',           null, 'palette', 'orange', 53),

  ('ext:psychology__behavior',              'Psychology › Behavior',              'Psychology', 'Behavior',    null,           'brain',      'blue',  60),
  ('ext:psychology__cognition',             'Psychology › Cognition',             'Psychology', 'Cognition',   null,           'brain',      'blue',  61)
on conflict (taxonomy_id) do nothing;
