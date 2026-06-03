/**
 * Dual-write helpers for the Phase 6 unification.
 *
 * The existing IG-specific tables (`profiles`, `profile_posts`, `saves`) keep
 * working. Each writer also mirrors its data into the platform-agnostic
 * `creators` + `creator_posts` tables so Phase 7+ features (Discover, Boards,
 * cross-platform queries) can read a single source of truth.
 *
 * Server-only.
 */
import { getSupabase } from "./supabase";
import type { PlatformKind } from "./types";

/** Find-or-create a creators row keyed by (workspace_id, platform, handle). */
export async function upsertCreator(
  workspaceId: string,
  platform: PlatformKind,
  handle: string,
  patch?: Partial<{
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
    sync_status: "idle" | "syncing" | "failed";
    sync_error: string | null;
    raw_profile_json: unknown;
  }>
): Promise<string | null> {
  if (!handle) return null;
  const sb = getSupabase();

  const existing = await sb
    .from("creators")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("platform", platform)
    .eq("handle", handle)
    .limit(1);
  const existingId = (existing.data?.[0] as { id: string } | undefined)?.id;

  let creatorId: string | null = null;
  if (existingId) {
    if (patch && Object.keys(patch).length > 0) {
      await sb.from("creators").update(patch).eq("id", existingId);
    }
    creatorId = existingId;
  } else {
    const inserted = await sb
      .from("creators")
      .insert({
        workspace_id: workspaceId,
        platform,
        handle,
        ...(patch || {}),
      })
      .select("id")
      .single();
    creatorId = (inserted.data as { id: string } | null)?.id ?? null;
  }

  // Fire-and-forget avatar mirror when the supplied avatar isn't yet hosted
  // on our CDN. Skip via DISABLE_AUTO_MIRROR=1.
  if (
    creatorId &&
    process.env.DISABLE_AUTO_MIRROR !== "1" &&
    patch?.avatar_url &&
    !/\/social-mirror\//.test(patch.avatar_url)
  ) {
    enqueueAvatarMirror({
      id: creatorId,
      avatar_url: patch.avatar_url,
      platform,
    });
  }

  return creatorId;
}

function enqueueAvatarMirror(creator: {
  id: string;
  avatar_url: string;
  platform: PlatformKind;
}): void {
  void (async () => {
    try {
      const mod = await import("./mirror");
      await mod.mirrorAvatar(creator);
    } catch (e) {
      console.warn(`[mirror] avatar ${creator.id} failed:`, e);
    }
  })();
}

export type CreatorPostUpsert = {
  creator_id: string | null;
  platform: PlatformKind;
  platform_pk: string;
  code?: string | null;
  url: string;
  media_type?: string | null;
  media_format?: string | null;
  title_or_caption?: string | null;
  transcript?: string | null;
  vision_analysis_md?: string | null;
  vision_analyzed_at?: string | null;
  like_count?: number;
  comment_count?: number;
  view_count?: number;
  play_count?: number;
  engagement_rate?: number | null;
  outlier_multiplier?: number | null;
  published_at?: string | null;
  thumbnail_url?: string | null;
  raw_json?: unknown;
};

/**
 * Find-or-create a creator_posts row.
 *
 * Dedup is scoped to the post's creator (which is per-workspace), NOT just
 * (platform, platform_pk): creator_posts has no workspace_id column, so the
 * workspace is reachable only via creator_id → creators.workspace_id. Keying
 * globally would let one workspace's ingest of a public post reassign (steal)
 * another workspace's existing row. With a creator_id, the same public post
 * ingested by two workspaces correctly yields one row per workspace.
 */
export async function upsertCreatorPost(
  row: CreatorPostUpsert
): Promise<string | null> {
  const sb = getSupabase();
  let lookup = sb
    .from("creator_posts")
    .select("id")
    .eq("platform", row.platform)
    .eq("platform_pk", row.platform_pk);
  if (row.creator_id) lookup = lookup.eq("creator_id", row.creator_id);
  const existing = await lookup.limit(1);
  const existingId = (existing.data?.[0] as { id: string } | undefined)?.id;

  let postId: string | null = null;

  if (existingId) {
    // Only set fields the caller supplied; don't clobber existing ones with null.
    const update: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v !== undefined) update[k] = v;
    }
    if (Object.keys(update).length > 0) {
      await sb.from("creator_posts").update(update).eq("id", existingId);
    }
    postId = existingId;
  } else {
    const inserted = await sb
      .from("creator_posts")
      .insert(row)
      .select("id")
      .single();
    postId = (inserted.data as { id: string } | null)?.id ?? null;
  }

  // Fire-and-forget enrichment + thumbnail mirror so ingest doesn't block on
  // Gemini / network I/O. Skip via DISABLE_AUTO_ENRICH=1 / DISABLE_AUTO_MIRROR=1.
  if (postId) {
    if (process.env.DISABLE_AUTO_ENRICH !== "1") enqueueEnrichment(postId);
    if (process.env.DISABLE_AUTO_EMBED !== "1" && row.title_or_caption) {
      void import("./embed-post").then((m) => m.enqueueEmbed(postId!));
    }
    if (process.env.DISABLE_AUTO_MIRROR !== "1") {
      const thumb = row.thumbnail_url;
      if (thumb && !/\/social-mirror\//.test(thumb)) {
        enqueueMirror({
          id: postId,
          platform: row.platform,
          platform_pk: row.platform_pk,
          thumbnail_url: thumb,
        });
      }
    }
  }

  return postId;
}

/** Spawns a deferred enrichment without awaiting. */
function enqueueEnrichment(postId: string): void {
  void (async () => {
    try {
      const mod = await import("./enrich");
      await mod.enrichPost(postId);
    } catch (e) {
      console.warn(`[enrich] post ${postId} failed:`, e);
    }
  })();
}

/** Spawns a deferred thumbnail mirror without awaiting. */
function enqueueMirror(post: {
  id: string;
  platform: PlatformKind;
  platform_pk: string;
  thumbnail_url: string;
}): void {
  void (async () => {
    try {
      const mod = await import("./mirror");
      await mod.mirrorThumbnail(post);
    } catch (e) {
      console.warn(`[mirror] post ${post.id} failed:`, e);
    }
  })();
}

/** Update vision_analysis on the matching creator_posts row by media_pk. */
export async function mirrorVisionToCreatorPost(
  mediaPk: string,
  vision_md: string
): Promise<void> {
  const sb = getSupabase();
  await sb
    .from("creator_posts")
    .update({
      vision_analysis_md: vision_md,
      vision_analyzed_at: new Date().toISOString(),
    })
    .eq("platform", "instagram")
    .eq("platform_pk", mediaPk);
}

/** Update transcript on the matching creator_posts row by media_pk. */
export async function mirrorTranscriptToCreatorPost(
  mediaPk: string,
  transcript: string
): Promise<void> {
  const sb = getSupabase();
  await sb
    .from("creator_posts")
    .update({ transcript })
    .eq("platform", "instagram")
    .eq("platform_pk", mediaPk);
}
