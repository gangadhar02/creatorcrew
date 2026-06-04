-- migration_026_creator_is_followed.sql
--
-- Bug fix: a Discover web search ("Pull from web") ingests posts for every
-- author it finds, which created a creators row for each one. Those authors then
-- showed up in the user's Creators list ("All Following") even though the user
-- never chose to follow them.
--
-- Fix: distinguish creators the user explicitly added/followed from creators
-- merely surfaced by a web search. Add is_followed:
--   true  -> explicitly added (Add creator, profile analyze, saves, etc.)
--   false -> auto-created only as a byproduct of a Discover web search
--
-- The Creators list filters to is_followed = true. Discover still reads the
-- posts via creator_posts, so search results keep working.
--
-- Existing rows default to true (preserve current behavior; the user can
-- bulk-delete any already-polluted creators). Apply by hand in the Supabase
-- SQL editor.

alter table creators
  add column if not exists is_followed boolean not null default true;

create index if not exists creators_followed_idx
  on creators(workspace_id, is_followed);
