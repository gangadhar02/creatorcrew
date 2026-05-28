import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * GET /api/home-feed?sort=&platform=&list=&limit=
 *
 * Returns posts from followed creators only. If `list` is set, restrict to
 * creators in that list. Sort matches Eden's home tabs.
 */
export async function GET(req: NextRequest) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) {
    return NextResponse.json({ posts: [], hasFollowing: false });
  }

  const sp = req.nextUrl.searchParams;
  const sort = sp.get("sort") || "recent";
  const platform = sp.get("platform") || "all";
  const listId = sp.get("list");
  const limit = Math.min(Number(sp.get("limit") || "24"), 60);

  const sb = getSupabase();

  // 1. Resolve creator-ids the user "follows" — for now: any creator that
  //    appears in at least one creator_list, OR every creator if no lists yet.
  const { data: members } = await sb
    .from("creator_list_members")
    .select("creator_id, list_id");
  const allFollowed = new Set<string>();
  const byList: Record<string, Set<string>> = {};
  for (const m of (members || []) as { creator_id: string; list_id: string }[]) {
    allFollowed.add(m.creator_id);
    if (!byList[m.list_id]) byList[m.list_id] = new Set();
    byList[m.list_id].add(m.creator_id);
  }

  const hasFollowing = allFollowed.size > 0;

  let creatorFilter: Set<string> | null = null;
  if (listId) {
    creatorFilter = byList[listId] || new Set();
  } else if (hasFollowing) {
    creatorFilter = allFollowed;
  }

  // 2. Build query
  let q = sb
    .from("creator_posts")
    .select(
      `id, platform, platform_pk, code, url, media_type, title_or_caption, thumbnail_url,
       outlier_multiplier, view_count, play_count, like_count, comment_count, published_at,
       creator:creators!inner(id, handle, display_name, follower_count, avatar_url, is_verified, platform, workspace_id)`
    )
    .eq("creators.workspace_id", ws.workspaceId);

  if (platform !== "all") q = q.eq("platform", platform);
  if (creatorFilter && creatorFilter.size > 0) {
    q = q.in("creator_id", Array.from(creatorFilter));
  }

  // Sort
  if (sort === "outlier") {
    q = q.order("outlier_multiplier", { ascending: false, nullsFirst: false });
  } else if (sort === "top_liked") {
    q = q.order("like_count", { ascending: false });
  } else if (sort === "top_viewed") {
    q = q.order("view_count", { ascending: false });
  } else {
    q = q.order("published_at", { ascending: false, nullsFirst: false });
  }

  q = q.limit(limit);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json(
      { posts: [], hasFollowing, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    posts: data || [],
    hasFollowing,
  });
}
