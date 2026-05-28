-- Migration 015 — Interaction events + personalization signal store (Phase C.4)

create table if not exists post_events (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  content_id    uuid not null references creator_posts(id) on delete cascade,
  creator_id    uuid references creators(id) on delete set null,
  session_id    uuid,
  event_type    text not null,       -- view | dwell | impression | click | save | boost
  dwell_ms      integer,
  position      integer,
  surface       text,                -- feeds | profile | boost-modal | home
  view_mode     text,                -- grid | list
  tab           text,                -- discover | home | creators
  metadata      jsonb,
  occurred_at   bigint not null      -- unix ms
);

create index if not exists post_events_ws_time_idx
  on post_events(workspace_id, occurred_at desc);
create index if not exists post_events_ws_type_idx
  on post_events(workspace_id, event_type, occurred_at desc);
create index if not exists post_events_content_idx
  on post_events(content_id);
