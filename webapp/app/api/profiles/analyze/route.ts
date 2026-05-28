/**
 * POST /api/profiles/analyze
 * Body: { handle: string, maxPosts?: number }
 *
 * Fetches profile metadata + recent posts from Instagram, computes outlier /
 * engagement / typical stats, and upserts into `profiles` + `profile_posts`.
 * Returns the profile row.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  fetchProfile,
  fetchUserPosts,
  normalizePost,
  computeProfileStats,
  computeEngagementRate,
  computeOutlier,
  IGSessionInvalid,
} from "@/lib/instagram";
import {
  getDefaultWorkspaceId,
  upsertCreator,
  upsertCreatorPost,
} from "@/lib/dual-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function cleanHandle(input: string): string {
  return input.replace(/^@/, "").trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  const { handle: handleRaw, maxPosts } = (await request.json()) as {
    handle: string;
    maxPosts?: number;
  };
  if (!handleRaw) {
    return NextResponse.json({ error: "handle required" }, { status: 400 });
  }
  const handle = cleanHandle(handleRaw);
  const sb = getSupabase();

  // Mark / create profile row as syncing
  const existing = await sb
    .from("profiles")
    .select("id")
    .eq("ig_handle", handle)
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
      .insert({ ig_handle: handle, sync_status: "syncing" })
      .select("id")
      .single();
    if (ins.error || !ins.data) {
      return NextResponse.json(
        { error: ins.error?.message || "insert failed" },
        { status: 500 }
      );
    }
    profileId = (ins.data as { id: string }).id;
  }

  try {
    // 1. Profile metadata
    const profile = await fetchProfile(handle);

    // 2. Recent posts. Default 90; user can override up to 500 per call.
    const requested = maxPosts ?? 90;
    const items = await fetchUserPosts(profile.id, {
      maxPosts: Math.max(1, Math.min(requested, 500)),
    });
    const normalized = items
      .map(normalizePost)
      .filter((p): p is NonNullable<typeof p> => p !== null);

    // 3. Compute typical stats from the batch
    const stats = computeProfileStats(normalized);

    // 4. Upsert posts (one batch insert with onConflict).
    //    We persist ig_raw_json so we can re-extract anything later, though
    //    embedded CDN URLs expire — call fetchMediaByPk for fresh URLs.
    const itemsByPk: Record<string, unknown> = {};
    for (const it of items) {
      if (it.pk) itemsByPk[String(it.pk)] = it;
    }
    const rows = normalized.map((p) => ({
      profile_id: profileId,
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
    //    Best-effort: if these fail, the profile analyze still succeeds.
    const wsId = await getDefaultWorkspaceId();
    if (wsId) {
      const creatorId = await upsertCreator(wsId, "instagram", handle, {
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
    }

    return NextResponse.json({
      ok: true,
      profile_id: profileId,
      handle,
      posts_cached: rows.length,
      typical_reel_views: stats.typical_reel_views,
      typical_post_likes: stats.typical_post_likes,
    });
  } catch (e) {
    const msg = e instanceof IGSessionInvalid ? e.message : String(e);
    await sb
      .from("profiles")
      .update({ sync_status: "failed", sync_error: msg })
      .eq("id", profileId);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
