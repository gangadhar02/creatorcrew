/**
 * GET /api/discover
 * Filters:
 *   platform=instagram,youtube,…   (comma-separated, or 'all')
 *   pillar=<uuid>                  (one pillar id, or 'all')
 *   min_outlier=2                  (numeric)
 *   followers_min, followers_max   (numeric)
 *   range=all|30d|90d|6mo|1y
 *   hide_seen=1
 *   sort=outlier|recent|top_liked|top_viewed
 *   limit, offset
 *
 * Returns: { results: CreatorPostWithCreator[], count }
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rangeCutoff(range: string): string | null {
  const days: Record<string, number> = {
    "30d": 30,
    "90d": 90,
    "6mo": 180,
    "1y": 365,
  };
  if (!days[range]) return null;
  const d = new Date();
  d.setDate(d.getDate() - days[range]);
  return d.toISOString();
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const platforms =
    sp.get("platform") === "all" || !sp.get("platform")
      ? null
      : sp.get("platform")!.split(",").map((s) => s.trim()).filter(Boolean);
  const pillar = sp.get("pillar") || "all";
  const minOutlier = parseFloat(sp.get("min_outlier") || "0");
  const followersMin = sp.get("followers_min")
    ? parseInt(sp.get("followers_min")!, 10)
    : null;
  const followersMax = sp.get("followers_max")
    ? parseInt(sp.get("followers_max")!, 10)
    : null;
  const range = sp.get("range") || "all";
  const hideSeen = sp.get("hide_seen") === "1";
  const sort = sp.get("sort") || "outlier";
  const limit = Math.min(parseInt(sp.get("limit") || "60", 10) || 60, 200);
  const offset = parseInt(sp.get("offset") || "0", 10) || 0;

  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) {
    return NextResponse.json({ results: [], count: 0, error: "no workspace" });
  }
  const sb = getSupabase();

  let q = sb
    .from("creator_posts")
    .select(
      "id, platform, platform_pk, code, url, media_type, title_or_caption, like_count, comment_count, view_count, play_count, engagement_rate, outlier_multiplier, published_at, thumbnail_url, transcript, vision_analysis_md, pillar_id, creator:creators!inner(id, handle, display_name, follower_count, avatar_url, is_verified, platform, workspace_id)",
      { count: "exact" }
    )
    .eq("creators.workspace_id", ws.workspaceId);

  if (platforms) q = q.in("platform", platforms);
  if (pillar !== "all") q = q.eq("pillar_id", pillar);
  if (minOutlier > 0) q = q.gte("outlier_multiplier", minOutlier);
  if (followersMin !== null)
    q = q.gte("creators.follower_count", followersMin);
  if (followersMax !== null)
    q = q.lte("creators.follower_count", followersMax);
  const cutoff = rangeCutoff(range);
  if (cutoff) q = q.gte("published_at", cutoff);

  switch (sort) {
    case "recent":
      q = q.order("published_at", { ascending: false, nullsFirst: false });
      break;
    case "top_liked":
      q = q.order("like_count", { ascending: false });
      break;
    case "top_viewed":
      q = q.order("view_count", { ascending: false });
      break;
    case "outlier":
    default:
      q = q.order("outlier_multiplier", {
        ascending: false,
        nullsFirst: false,
      });
  }

  q = q.range(offset, offset + limit - 1);

  const { data, error, count } = await q;
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  let results = data || [];

  // hide_seen: filter out posts the user has already viewed
  if (hideSeen && results.length > 0) {
    const ids = results.map((r) => (r as { id: string }).id);
    const seenRes = await sb
      .from("post_seen")
      .select("post_id")
      .eq("workspace_id", ws.workspaceId)
      .in("post_id", ids);
    const seenIds = new Set(
      (seenRes.data || []).map((r) => (r as { post_id: string }).post_id)
    );
    results = results.filter((r) => !seenIds.has((r as { id: string }).id));
  }

  return NextResponse.json({ results, count: count ?? 0 });
}
