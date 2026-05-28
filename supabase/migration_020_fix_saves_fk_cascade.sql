-- Migration 020 — Relax saves.creator_post_id FK to ON DELETE SET NULL
--
-- Migration 005 added saves.creator_post_id with the default NO ACTION
-- delete rule. When we cascade-delete a creator (creators → creator_posts
-- → ???), Postgres blocks at saves with:
--   "update or delete on table 'creator_posts' violates foreign key
--    constraint 'saves_creator_post_id_fkey' on table 'saves'"
--
-- The right semantic: if a creator_post is deleted, the saves row that
-- referenced it should keep existing (it's the user's bookmark — they
-- still own the original Instagram URL), but the link column nulls out.

alter table saves
  drop constraint if exists saves_creator_post_id_fkey;

alter table saves
  add constraint saves_creator_post_id_fkey
  foreign key (creator_post_id)
  references creator_posts(id)
  on delete set null;
