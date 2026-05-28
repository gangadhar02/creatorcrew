-- Migration 008 — Boards + Cards + Documents + Files (Phase 9)
-- Paste into Supabase SQL Editor → Run.

-- ============================================================================
-- boards
-- ============================================================================
create table if not exists boards (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid references workspaces(id) on delete cascade,  -- null for templates
  name                  text not null,
  description           text,
  icon                  text,
  color                 text default 'gray',
  voice_id              uuid references voices(id) on delete set null,
  kind                  text default 'board' check (kind in ('board', 'template')),
  parent_template_id    uuid references boards(id) on delete set null,
  position              integer default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists boards_workspace_idx on boards(workspace_id);
create index if not exists boards_kind_idx on boards(kind);

drop trigger if exists boards_updated_at on boards;
create trigger boards_updated_at before update on boards
  for each row execute function set_updated_at();

alter table boards disable row level security;

-- ============================================================================
-- cards: sticky-note items inside boards
-- ============================================================================
create table if not exists cards (
  id          uuid primary key default gen_random_uuid(),
  body_md     text default '',
  color       text default 'gray',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists cards_updated_at on cards;
create trigger cards_updated_at before update on cards
  for each row execute function set_updated_at();

alter table cards disable row level security;

-- ============================================================================
-- documents: longer-form markdown documents (TipTap-edited)
-- ============================================================================
create table if not exists documents (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default 'Untitled',
  body_md     text default '',
  voice_id    uuid references voices(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists documents_updated_at on documents;
create trigger documents_updated_at before update on documents
  for each row execute function set_updated_at();

alter table documents disable row level security;

-- ============================================================================
-- files: uploaded images, PDFs, other files (stored in Supabase Storage)
-- ============================================================================
create table if not exists files (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('image', 'pdf', 'file')),
  storage_bucket  text not null default 'board-files',
  storage_path    text not null,
  original_name   text,
  size_bytes      bigint,
  mime_type       text,
  created_at      timestamptz not null default now()
);

alter table files disable row level security;

-- ============================================================================
-- board_items: polymorphic placement of (post|card|document|file) on a board
-- ============================================================================
create table if not exists board_items (
  id                  uuid primary key default gen_random_uuid(),
  board_id            uuid not null references boards(id) on delete cascade,
  kind                text not null check (kind in ('post', 'card', 'document', 'file')),
  position            integer default 0,
  tag                 text,
  creator_post_id     uuid references creator_posts(id) on delete set null,
  card_id             uuid references cards(id) on delete cascade,
  document_id         uuid references documents(id) on delete cascade,
  file_id             uuid references files(id) on delete cascade,
  created_at          timestamptz not null default now(),
  check (
    ((creator_post_id is not null)::int +
     (card_id is not null)::int +
     (document_id is not null)::int +
     (file_id is not null)::int) = 1
  )
);

create index if not exists board_items_board_idx       on board_items(board_id, position);
create index if not exists board_items_creator_post_idx on board_items(creator_post_id);
create index if not exists board_items_card_idx        on board_items(card_id);
create index if not exists board_items_doc_idx         on board_items(document_id);
create index if not exists board_items_file_idx        on board_items(file_id);
create index if not exists board_items_tag_idx         on board_items(board_id, tag);

alter table board_items disable row level security;

-- ============================================================================
-- Seed: 4 template boards (kind='template', workspace_id is null = global)
-- Uses dollar-quoted strings + plain ASCII icons so clipboard/editor encoding
-- can't break the inserts.
-- ============================================================================

insert into boards (workspace_id, name, description, icon, color, kind, position)
select null,
  $txt$Viral Reels & Shorts$txt$,
  $txt$Write viral reels and shorts in your voice by chatting with this board. Comes with examples of hooks, retention beats, and shot lists.$txt$,
  $txt$Reel$txt$,
  'pink', 'template', 1
where not exists (select 1 from boards where kind = 'template' and name = 'Viral Reels & Shorts');

insert into boards (workspace_id, name, description, icon, color, kind, position)
select null,
  $txt$Viral Tweets$txt$,
  $txt$Write viral tweets in your voice by chatting with this board. Comes with proven thread structures and hook patterns.$txt$,
  $txt$X$txt$,
  'gray', 'template', 2
where not exists (select 1 from boards where kind = 'template' and name = 'Viral Tweets');

insert into boards (workspace_id, name, description, icon, color, kind, position)
select null,
  $txt$Viral YouTube Videos$txt$,
  $txt$Write viral YouTube scripts in your voice by chatting with this board. Comes with title formulas and chapter structures.$txt$,
  $txt$YT$txt$,
  'red', 'template', 3
where not exists (select 1 from boards where kind = 'template' and name = 'Viral YouTube Videos');

insert into boards (workspace_id, name, description, icon, color, kind, position)
select null,
  $txt$Weekly Content Workflow$txt$,
  $txt$Plan, research, draft, and ship a week of content from one board. Drop top posts into the swipe file, draft alongside them.$txt$,
  $txt$Cal$txt$,
  'blue', 'template', 4
where not exists (select 1 from boards where kind = 'template' and name = 'Weekly Content Workflow');
