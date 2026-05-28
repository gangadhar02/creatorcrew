/**
 * Phase 9 (Boards) types.
 */
export type BoardKind = "board" | "template";
export type BoardItemKind = "post" | "card" | "document" | "file";
export type FileKind = "image" | "pdf" | "file";

export interface Board {
  id: string;
  workspace_id: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  color: string;
  voice_id: string | null;
  kind: BoardKind;
  parent_template_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: string;
  body_md: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  title: string;
  body_md: string;
  voice_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileRow {
  id: string;
  kind: FileKind;
  storage_bucket: string;
  storage_path: string;
  original_name: string | null;
  size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface BoardItem {
  id: string;
  board_id: string;
  kind: BoardItemKind;
  position: number;
  tag: string | null;
  creator_post_id: string | null;
  card_id: string | null;
  document_id: string | null;
  file_id: string | null;
  created_at: string;
}
