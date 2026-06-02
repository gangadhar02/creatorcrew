/**
 * Profile Analyzer core — pulled out of the API route so it can be called
 * from BOTH:
 *   - The `POST /api/profiles/analyze` route (local dev fallback)
 *   - The Node CLI in `scripts/analyze-profile.ts` (GitHub Actions runner)
 *
 * Inputs: workspaceId + handle + cap.
 * Side effects:
 *   - upserts a `profiles` row + `profile_posts` for that workspace
 *   - dual-writes the same data into `creators` + `creator_posts`
 *
 * Returns a small summary so the caller can update an analyzer_jobs row.
 */
import { getSupabase } from "./supabase";
import {
  fetchProfile,
  fetchUserPosts,
  normalizePost,
  computeProfileStats,
  computeEngagementRate,
  computeOutlier,
  type IGProfile,
  type IGMediaItem,
} from "./instagram";
import {
  isGraphApiConfigured,
  fetchProfileAndPostsGraph,
  IGGraphUnsupported,
} from "./instagram-graph";
import {
  isApifyConfigured,
  fetchProfileAndPostsApify,
} from "./instagram-apify";
import {
  upsertCreator,
  upsertCreatorPost,
} from "./dual-write";

/** Default number of recent posts to fetch. 40 is enough for typical/outlier
 *  stats to stabilize while keeping per-analysis cost low (Apify bills per
 *  result). Override per-request via the `cap` option / `maxPosts` body field. */
export const DEFAULT_PROFILE_CAP = 40;

export type ProfileAnalysisResult = {
  profileId: string;
  creatorId: string | null;
  handle: string;
  postsCached: number;
  typicalReelViews: number | null;
  typicalPostLikes: number | null;
};

function cleanHandle(input: string): string {
  return input.replace(/^@/, "").trim().toLowerCase();
}

type FetchSource = "apify" | "graph" | "cookie";

/**
 * Decide which fetch path to use, controlled by IG_FETCH_MODE:
 *   "apify"  → always use the Apify Instagram Scraper
 *   "graph"  → always use the official Business Discovery API
 *   "cookie" → always use the direct cookie scraper
 *   "auto"   → prefer Apify, then Graph, then cookie — based on what's
 *              configured (default)
 */
function fetchMode(): FetchSource | "auto" {
  const m = process.env.IG_FETCH_MODE?.trim().toLowerCase();
  if (m === "apify" || m === "graph" || m === "cookie") return m;
  return "auto";
}

async function fetchViaCookie(
  handle: string,
  cap: number
): Promise<{ profile: IGProfile; items: IGMediaItem[]; source: FetchSource }> {
  const profile = await fetchProfile(handle);
  const items = await fetchUserPosts(profile.id, { maxPosts: cap });
  return { profile, items, source: "cookie" };
}

/**
 * Fetch profile + recent posts via Apify / Graph / cookies, returning the
 * unified shapes the rest of the analyzer consumes.
 *
 * In "auto" mode the backends are tried in preference order (Apify → Graph →
 * cookie) and any failure falls back to the next available one. A backend
 * forced via IG_FETCH_MODE is used as-is with no fallback — except Graph, where
 * an IGGraphUnsupported target (personal/private account) still throws so the
 * caller sees the real reason.
 */
async function fetchProfileAndPosts(
  handle: string,
  cap: number
): Promise<{ profile: IGProfile; items: IGMediaItem[]; source: FetchSource }> {
  const mode = fetchMode();

  // Forced single backend (no fallback).
  if (mode === "apify") return { ...(await fetchProfileAndPostsApify(handle, cap)), source: "apify" };
  if (mode === "graph") return { ...(await fetchProfileAndPostsGraph(handle, cap)), source: "graph" };
  if (mode === "cookie") return fetchViaCookie(handle, cap);

  // auto: Apify → Graph → cookie, falling back on error.
  if (isApifyConfigured()) {
    try {
      return { ...(await fetchProfileAndPostsApify(handle, cap)), source: "apify" };
    } catch (e) {
      console.warn(
        `[profile-analyzer] Apify failed for @${handle} (${(e as Error).message}); trying next backend.`
      );
    }
  }
  if (isGraphApiConfigured()) {
    try {
      return { ...(await fetchProfileAndPostsGraph(handle, cap)), source: "graph" };
    } catch (e) {
      const why = e instanceof IGGraphUnsupported ? "unsupported target" : (e as Error).message;
      console.warn(
        `[profile-analyzer] Graph failed for @${handle} (${why}); falling back to cookie scraper.`
      );
    }
  }
  return fetchViaCookie(handle, cap);
}

export async function runProfileAnalysis(opts: {
  workspaceId: string;
  handle: string;
  cap?: number;
}): Promise<ProfileAnalysisResult> {
  const handle = cleanHandle(opts.handle);
  const cap = Math.max(1, Math.min(opts.cap ?? DEFAULT_PROFILE_CAP, 500));
  const sb = getSupabase();

  // Mark / create profile row as syncing — scoped to this workspace so each
  // workspace keeps its own analysis of a given handle.
  const existing = await sb
    .from("profiles")
    .select("id")
    .eq("ig_handle", handle)
    .eq("workspace_id", opts.workspaceId)
    .maybeSingle();
  let profileId: string;
  if (existing.data) {
    profileId = (existing.data as { id: string }).id;
    await sb
      .from("profiles")
      .update({ sync_status: "syncing", sync_error: null })
      .eq("id", profileId);
  } else {
    const ins = await sb
      .from("profiles")
      .insert({
        ig_handle: handle,
        sync_status: "syncing",
        workspace_id: opts.workspaceId,
      })
      .select("id")
      .single();
    if (ins.error || !ins.data) {
      throw new Error(ins.error?.message || "profile insert failed");
    }
    profileId = (ins.data as { id: string }).id;
  }

  try {
    // 1 + 2. Profile metadata + recent posts (Graph API or cookie scraper).
    const { profile, items } = await fetchProfileAndPosts(handle, cap);
    const normalized = items
      .map(normalizePost)
      .filter((p): p is NonNullable<typeof p> => p !== null);

    // 3. Compute typical stats from the batch
    const stats = computeProfileStats(normalized);

    // 4. Upsert posts (one batch upsert).
    const itemsByPk: Record<string, unknown> = {};
    for (const it of items) {
      if (it.pk) itemsByPk[String(it.pk)] = it;
    }
    const rows = normalized.map((p) => ({
      profile_id: profileId,
      workspace_id: opts.workspaceId,
      media_pk: p.media_pk,
      code: p.code,
      url: p.url,
      type: p.type,
      caption: p.caption || null,
      like_count: p.like_count,
      comment_count: p.comment_count,
      view_count: p.view_count,
      play_count: p.play_count,
      taken_at: p.taken_at,
      thumbnail_url: p.thumbnail_url,
      engagement_rate: computeEngagementRate(p),
      outlier_multiplier: computeOutlier(p, stats),
      ig_raw_json: itemsByPk[p.media_pk] ?? null,
    }));
    if (rows.length > 0) {
      const { error: upErr } = await sb
        .from("profile_posts")
        .upsert(rows, { onConflict: "profile_id,media_pk" });
      if (upErr) throw new Error(`profile_posts upsert: ${upErr.message}`);
    }

    // 5. Finalize profile row
    const { error: finErr } = await sb
      .from("profiles")
      .update({
        display_name: profile.full_name,
        bio: profile.biography,
        follower_count: profile.follower_count,
        following_count: profile.following_count,
        post_count: profile.media_count,
        profile_pic_url: profile.profile_pic_url,
        is_verified: profile.is_verified,
        ig_user_id: profile.id,
        typical_reel_views: stats.typical_reel_views,
        typical_post_likes: stats.typical_post_likes,
        analyzed_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        sync_status: "idle",
        sync_error: null,
      })
      .eq("id", profileId);
    if (finErr) throw new Error(`profile update: ${finErr.message}`);

    // 6. Dual-write to creators + creator_posts (Phase 6 unification).
    let creatorId: string | null = null;
    creatorId = await upsertCreator(opts.workspaceId, "instagram", handle, {
      display_name: profile.full_name || null,
      bio: profile.biography || null,
      follower_count: profile.follower_count,
      following_count: profile.following_count,
      post_count: profile.media_count,
      avatar_url: profile.profile_pic_url || null,
      is_verified: profile.is_verified,
      ig_user_id: profile.id,
      typical_reel_views: stats.typical_reel_views,
      typical_post_likes: stats.typical_post_likes,
      last_synced_at: new Date().toISOString(),
      sync_status: "idle",
    });
    if (creatorId) {
      for (const p of normalized) {
        await upsertCreatorPost({
          creator_id: creatorId,
          platform: "instagram",
          platform_pk: p.media_pk,
          code: p.code,
          url: p.url,
          media_type: p.type,
          title_or_caption: p.caption || null,
          like_count: p.like_count,
          comment_count: p.comment_count,
          view_count: p.view_count,
          play_count: p.play_count,
          engagement_rate: computeEngagementRate(p),
          outlier_multiplier: computeOutlier(p, stats),
          published_at: p.taken_at,
          thumbnail_url: p.thumbnail_url,
          raw_json: itemsByPk[p.media_pk] ?? null,
        });
      }
    }

    return {
      profileId,
      creatorId,
      handle,
      postsCached: rows.length,
      typicalReelViews: stats.typical_reel_views,
      typicalPostLikes: stats.typical_post_likes,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb
      .from("profiles")
      .update({ sync_status: "failed", sync_error: msg })
      .eq("id", profileId);
    throw e;
  }
}
