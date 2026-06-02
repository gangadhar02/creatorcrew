-- ============================================================================
-- migration_022_tldraw_canvas.sql
-- Persist the tldraw whiteboard document for the Boards and Bookmarks canvases.
--
-- We migrated both canvases from React Flow to tldraw (full freeform whiteboard:
-- content tiles + drawings/arrows/sticky-notes/text). tldraw owns the LAYOUT and
-- any freeform shapes, stored as a single JSON document snapshot. The existing
-- rows (board_items / bookmark_items) remain the source of truth for WHICH
-- content tiles exist; each tile is a custom `content-tile` shape that references
-- a row by id, so the snapshot stays small and rich content is always read fresh
-- from its table.
--
-- Apply by hand in the Supabase SQL editor (there is no migration runner).
-- ============================================================================

-- Boards: one canvas document per board.
alter table boards add column if not exists canvas_state jsonb;

-- Bookmarks: one canvas document per workspace (the bookmarks canvas is a single
-- per-workspace surface, not per-board).
create table if not exists bookmark_canvas (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  canvas_state jsonb,
  updated_at   timestamptz not null default now()
);

-- RLS to match the workspace-owner pattern (server uses the service-role key and
-- bypasses this; the policy is hygiene for any authenticated browser access).
alter table bookmark_canvas enable row level security;
drop policy if exists "ws_owner_all_bookmark_canvas" on bookmark_canvas;
create policy "ws_owner_all_bookmark_canvas" on bookmark_canvas for all to authenticated
  using (is_workspace_owner(workspace_id))
  with check (is_workspace_owner(workspace_id));
