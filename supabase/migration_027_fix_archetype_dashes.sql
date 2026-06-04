-- Migration 027: clean corrupted/banned dashes from seeded archetype voices.
--
-- Two problems in the live `voices` archetype rows:
--   1. The migration_004 seed copy used em-dashes (banned in CreatorCrew copy).
--   2. When that seed was applied, some rows were stored with double-encoded
--      bytes that render as the mojibake sequence "‚Äî" (a corrupted em-dash).
--
-- migration_004 seeds with `where not exists`, so re-running it never touches
-- existing rows. This migration repairs the rows already in the database.
-- Safe to run multiple times (idempotent: the replaces no-op once clean).

-- Known-corrupted fields → explicit clean values (no dashes).
update voices
  set mission_md = 'Share the unsexy systems that compound, the ones that actually move the number.'
  where is_archetype = true and name = 'The Operator';

update voices
  set tone_md = 'Patient, warm, methodical. Never condescending. Assume curiosity, not ignorance.'
  where is_archetype = true and name = 'The Educator';

-- Defensive sweep: strip any remaining mojibake or em/en dashes from the
-- user-facing markdown columns on archetype rows, collapsing " — " style
-- separators down to ", ".
update voices set
  mission_md         = regexp_replace(regexp_replace(coalesce(mission_md, ''),         '\s*(‚Äî|‚Äì|—|–)\s*', ', ', 'g'), ',\s*,', ',', 'g'),
  audience_md        = regexp_replace(regexp_replace(coalesce(audience_md, ''),        '\s*(‚Äî|‚Äì|—|–)\s*', ', ', 'g'), ',\s*,', ',', 'g'),
  pov_md             = regexp_replace(regexp_replace(coalesce(pov_md, ''),             '\s*(‚Äî|‚Äì|—|–)\s*', ', ', 'g'), ',\s*,', ',', 'g'),
  core_ideas_md      = regexp_replace(regexp_replace(coalesce(core_ideas_md, ''),      '\s*(‚Äî|‚Äì|—|–)\s*', ', ', 'g'), ',\s*,', ',', 'g'),
  tone_md            = regexp_replace(regexp_replace(coalesce(tone_md, ''),            '\s*(‚Äî|‚Äì|—|–)\s*', ', ', 'g'), ',\s*,', ',', 'g'),
  always_do_md       = regexp_replace(regexp_replace(coalesce(always_do_md, ''),       '\s*(‚Äî|‚Äì|—|–)\s*', ', ', 'g'), ',\s*,', ',', 'g'),
  avoid_md           = regexp_replace(regexp_replace(coalesce(avoid_md, ''),           '\s*(‚Äî|‚Äì|—|–)\s*', ', ', 'g'), ',\s*,', ',', 'g'),
  formatting_md      = regexp_replace(regexp_replace(coalesce(formatting_md, ''),      '\s*(‚Äî|‚Äì|—|–)\s*', ', ', 'g'), ',\s*,', ',', 'g')
where is_archetype = true
  and (
    mission_md  ~ '(‚Äî|‚Äì|—|–)' or audience_md   ~ '(‚Äî|‚Äì|—|–)' or
    pov_md      ~ '(‚Äî|‚Äì|—|–)' or core_ideas_md ~ '(‚Äî|‚Äì|—|–)' or
    tone_md     ~ '(‚Äî|‚Äì|—|–)' or always_do_md  ~ '(‚Äî|‚Äì|—|–)' or
    avoid_md    ~ '(‚Äî|‚Äì|—|–)' or formatting_md ~ '(‚Äî|‚Äì|—|–)'
  );
