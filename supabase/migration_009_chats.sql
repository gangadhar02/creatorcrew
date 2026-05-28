-- Migration 009 — Universal Chat (Phase 10)
-- Paste into Supabase SQL Editor → Run.

create table if not exists chats (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid references workspaces(id) on delete cascade,
  title           text not null default 'New chat',
  voice_id        uuid references voices(id) on delete set null,
  context_kind    text check (context_kind in (
                    'creator_post', 'board', 'document', 'idea', 'save',
                    'voice_build', 'profile', 'freeform'
                  )),
  context_id      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists chats_workspace_idx     on chats(workspace_id);
create index if not exists chats_updated_at_idx    on chats(updated_at desc);
create index if not exists chats_context_idx       on chats(context_kind, context_id);

drop trigger if exists chats_updated_at on chats;
create trigger chats_updated_at before update on chats
  for each row execute function set_updated_at();

alter table chats disable row level security;

create table if not exists chat_messages (
  id                  uuid primary key default gen_random_uuid(),
  chat_id             uuid not null references chats(id) on delete cascade,
  role                text not null check (role in ('user', 'assistant', 'system')),
  content_md          text not null default '',
  thoughts_md         text,
  tool_calls          jsonb,
  attached_item_ids   text[],
  mentions            jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists chat_messages_chat_idx       on chat_messages(chat_id, created_at);

alter table chat_messages disable row level security;
