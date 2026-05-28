-- Migration 016 — Free-form positions for board_items (Phase D.1)

alter table board_items
  add column if not exists x integer default 0,
  add column if not exists y integer default 0,
  add column if not exists w integer default 320,
  add column if not exists h integer default 400;
