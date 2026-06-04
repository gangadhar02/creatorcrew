-- ============================================================================
-- migration_028_cards_docs_files_workspace.sql
-- Give cards / documents / files a direct workspace owner.
--
-- These tables (migration_008) had NO workspace_id; their API routes scoped
-- ownership indirectly by joining board_items -> boards.workspace_id. That
-- works for board-attached items but leaves standalone cards/documents with no
-- workspace owner. Add workspace_id directly, backfill from the existing
-- board_items -> boards link, and index it. The app now filters every read/
-- write by the current workspace.
--
-- Apply by hand in the Supabase SQL editor.
-- ============================================================================

-- cards --------------------------------------------------------------------
alter table cards add column if not exists workspace_id uuid references workspaces(id) on delete cascade;

update cards c
set workspace_id = b.workspace_id
from board_items bi
join boards b on b.id = bi.board_id
where bi.card_id = c.id
  and c.workspace_id is null
  and b.workspace_id is not null;

create index if not exists cards_workspace_idx on cards(workspace_id);

-- documents ----------------------------------------------------------------
alter table documents add column if not exists workspace_id uuid references workspaces(id) on delete cascade;

update documents d
set workspace_id = b.workspace_id
from board_items bi
join boards b on b.id = bi.board_id
where bi.document_id = d.id
  and d.workspace_id is null
  and b.workspace_id is not null;

create index if not exists documents_workspace_idx on documents(workspace_id);

-- files --------------------------------------------------------------------
alter table files add column if not exists workspace_id uuid references workspaces(id) on delete cascade;

update files f
set workspace_id = b.workspace_id
from board_items bi
join boards b on b.id = bi.board_id
where bi.file_id = f.id
  and f.workspace_id is null
  and b.workspace_id is not null;

create index if not exists files_workspace_idx on files(workspace_id);
