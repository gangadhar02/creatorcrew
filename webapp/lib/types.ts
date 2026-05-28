/**
 * Hand-rolled types matching supabase/schema.sql.
 * Easier than generating from supabase-cli for a small schema.
 */

export type SaveStatus = "New" | "Reviewed" | "Used";
export type SaveType = "Post" | "Reel" | "Carousel" | "IGTV";
export type IdeaStatus = "Not started" | "In progress" | "Done";
export type Priority = "High" | "Medium" | "Low";
export type Platform = "Instagram" | "X" | "YouTube";
export type Pillar = "Teach" | "Showcase" | "Tools" | "Process" | "Trends";
export type SyncRunStatus = "running" | "completed" | "failed";

export interface Save {
  id: string;
  media_pk: string;
  code: string | null;
  url: string;
  type: SaveType;
  author: string | null;
  caption: string | null;
  collection_name: string | null;
  status: SaveStatus;
  saved_at: string;
  vision_analysis_md: string | null;
  vision_analyzed_at: string | null;
  ig_raw_json: Record<string, unknown> | null;
  notes_md: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentIdea {
  id: string;
  save_id: string | null;
  name: string;
  pillar: Pillar | null;
  priority: Priority | null;
  format: string | null;
  platforms: Platform[] | null;
  angle: string | null;
  hook_curiosity: string | null;
  hook_value: string | null;
  hook_emotional: string | null;
  outline_md: string | null;
  ig_breakdown_md: string | null;
  x_breakdown_md: string | null;
  youtube_breakdown_md: string | null;
  body_md: string | null;
  week_of: string | null;
  status: IdeaStatus;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  ig_handle: string;
  display_name: string | null;
  bio: string | null;
  follower_count: number | null;
  following_count: number | null;
  post_count: number | null;
  analyzed_at: string;
  content_type_breakdown: Record<string, number> | null;
  hook_patterns: string[] | null;
  themes: string[] | null;
  posting_cadence: string | null;
  visual_style_md: string | null;
  raw_analysis_md: string | null;
  sample_post_ids: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface SyncRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: SyncRunStatus | null;
  new_count: number;
  skipped_count: number;
  total_count: number;
  vision_ok: number;
  vision_err: number;
  error_message: string | null;
  log_excerpt: string | null;
}

// ---------------------------------------------------------------------------
// Phase 4.5 / Phase 5 additions
// ---------------------------------------------------------------------------

export interface Workspace {
  id: string;
  name: string;
  owner_email: string | null;
  created_at: string;
  updated_at: string;
}

export type OnboardingTaskKey =
  | "build_voice"
  | "create_board"
  | "use_boost"
  | "add_creator_to_list";

export interface OnboardingProgress {
  workspace_id: string;
  task_key: OnboardingTaskKey;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Voice {
  id: string;
  workspace_id: string | null;
  name: string;
  archetype: string | null;
  mission_md: string | null;
  audience_md: string | null;
  pov_md: string | null;
  core_ideas_md: string | null;
  vocabulary: Record<string, unknown> | null;
  tone_md: string | null;
  always_do_md: string | null;
  avoid_md: string | null;
  formatting_md: string | null;
  writing_samples_md: string | null;
  source_links: string[] | null;
  is_default: boolean;
  is_archetype: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Phase 6 — cross-platform unification
// ---------------------------------------------------------------------------

export type PlatformKind =
  | "instagram"
  | "youtube"
  | "linkedin"
  | "substack"
  | "x"
  | "tiktok";

export interface Creator {
  id: string;
  workspace_id: string;
  platform: PlatformKind;
  handle: string;
  display_name: string | null;
  bio: string | null;
  follower_count: number | null;
  following_count: number | null;
  post_count: number | null;
  avatar_url: string | null;
  is_verified: boolean;
  ig_user_id: string | null;
  typical_reel_views: number | null;
  typical_post_likes: number | null;
  last_synced_at: string | null;
  sync_status: "idle" | "syncing" | "failed" | null;
  sync_error: string | null;
  raw_profile_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CreatorPost {
  id: string;
  creator_id: string | null;
  platform: PlatformKind;
  platform_pk: string;
  code: string | null;
  url: string;
  media_type: string | null;
  title_or_caption: string | null;
  transcript: string | null;
  vision_analysis_md: string | null;
  vision_analyzed_at: string | null;
  like_count: number;
  comment_count: number;
  view_count: number;
  play_count: number;
  share_count: number;
  engagement_rate: number | null;
  outlier_multiplier: number | null;
  published_at: string | null;
  thumbnail_url: string | null;
  raw_json: Record<string, unknown> | null;
  pillar_id: string | null;
  pillar_confidence: number | null;
  created_at: string;
  updated_at: string;
}

/** Tagged map for typed table access via SupabaseClient<Database>. */
export interface Database {
  public: {
    Tables: {
      saves: { Row: Save; Insert: Partial<Save>; Update: Partial<Save> };
      content_ideas: {
        Row: ContentIdea;
        Insert: Partial<ContentIdea>;
        Update: Partial<ContentIdea>;
      };
      profiles: {
        Row: Profile;
        Insert: Partial<Profile>;
        Update: Partial<Profile>;
      };
      sync_runs: {
        Row: SyncRun;
        Insert: Partial<SyncRun>;
        Update: Partial<SyncRun>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
