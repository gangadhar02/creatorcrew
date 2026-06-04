-- migration_025_board_items_creator_post_cascade.sql
--
-- Bug fix: deleting a creator (or any creator_post) threw
--   new row for relation "board_items" violates check constraint "board_items_check"
--
-- Why: board_items requires EXACTLY ONE of
--   (creator_post_id, card_id, document_id, file_id)
-- to be non-null (the board_items_check constraint). But the creator_post_id FK
-- was declared `on delete set null`. Deleting a creator cascade-deletes its
-- creator_posts, which then SET NULL on any board_items.creator_post_id. A
-- kind='post' board item then had ZERO non-null FK columns, violating the check,
-- so the whole delete transaction aborted.
--
-- Fix: switch the FK to `on delete cascade`, matching card_id / document_id /
-- file_id. Now deleting a post removes its board_items rows instead of nulling
-- them. Apply by hand in the Supabase SQL editor.

alter table board_items
  drop constraint if exists board_items_creator_post_id_fkey;

alter table board_items
  add constraint board_items_creator_post_id_fkey
  foreign key (creator_post_id) references creator_posts(id) on delete cascade;
