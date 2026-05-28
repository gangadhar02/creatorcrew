-- Migration 014 — Voice card v0/v1 versioning + carry-forward (Phase C.6)
-- Adds the structured fields Eden's voice profile uses, plus a history
-- snapshot trail so we can roll back a regression.

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
