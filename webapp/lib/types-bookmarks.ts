export type BookmarkPlatform = "instagram" | "x";

export type BookmarkItem = {
  id: string;
  workspace_id: string | null;
  platform: BookmarkPlatform;
  external_id: string;
  url: string;
  author_handle: string | null;
  author_name: string | null;
  caption: string | null;
  thumbnail_url: string | null;
  media_type: string | null;
  saved_at: string | null;
  tags: string[];
  notes_md: string;
  x: number;
  y: number;
  w: number;
  raw_json: Record<string, unknown> | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
};

export type BookmarkDraft = {
  platform: BookmarkPlatform;
  external_id: string;
  url: string;
  author_handle?: string | null;
  author_name?: string | null;
  caption?: string | null;
  thumbnail_url?: string | null;
  media_type?: string | null;
  saved_at?: string | null;
  raw_json?: Record<string, unknown> | null;
};
