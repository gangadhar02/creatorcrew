/**
 * Shared row shape for posts joined with their creator on the Discover feed
 * and elsewhere. Mirrors the supabase select() string.
 */
import type { PlatformKind } from "./types";
import type { AiOverview } from "./types-enrichment";

export interface PostWithCreator {
  id: string;
  platform: PlatformKind;
  platform_pk: string;
  code: string | null;
  url: string;
  media_type: string | null;
  title_or_caption: string | null;
  like_count: number;
  comment_count: number;
  view_count: number;
  play_count: number;
  engagement_rate: number | null;
  outlier_multiplier: number | null;
  published_at: string | null;
  thumbnail_url: string | null;
  transcript: string | null;
  vision_analysis_md: string | null;
  pillar_id: string | null;
  // Enrichment fields (migration 010) — nullable until backfilled.
  taxonomy_id?: string | null;
  taxonomy_label?: string | null;
  taxonomy_tier1?: string | null;
  content_type_label?: string | null;
  media_format?: string | null;
  mood?: string | null;
  ai_tags?: string[] | null;
  ai_description?: string | null;
  ai_overview?: AiOverview | null;
  enriched_at?: string | null;
  creator: {
    id: string;
    handle: string;
    display_name: string | null;
    follower_count: number | null;
    avatar_url: string | null;
    is_verified: boolean;
    platform: PlatformKind;
    workspace_id: string;
  };
}
