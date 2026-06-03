// GET /api/posts?ids=uuid1,uuid2,...
// Returns: { posts: SocialPostTile[] }  (order follows the requested ids)
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) return NextResponse.json({ posts: [] });

  const raw = (request.nextUrl.searchParams.get("ids") || "").trim();
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
  if (ids.length === 0) return NextResponse.json({ posts: [] });

  const sb = getSupabase();
  const { data } = await sb
    .from("creator_posts")
    .select(
      "id, url, platform, media_type, title_or_caption, thumbnail_url, like_count, comment_count, view_count, outlier_multiplier, creator:creators!inner(handle, avatar_url, workspace_id)"
    )
    .in("id", ids)
    .eq("creator.workspace_id", ws.workspaceId);

  const byId = new Map<string, Record<string, unknown>>();
  for (const r of (data || []) as Record<string, unknown>[]) {
    byId.set(r.id as string, r);
  }
  const posts = ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((r) => {
      const row = r as Record<string, unknown>;
      const c = (row.creator as Record<string, unknown>) || {};
      return {
        id: row.id,
        url: row.url,
        platform: row.platform,
        media_type: row.media_type ?? null,
        title_or_caption: row.title_or_caption ?? null,
        thumbnail_url: row.thumbnail_url ?? null,
        like_count: row.like_count ?? null,
        comment_count: row.comment_count ?? null,
        view_count: row.view_count ?? null,
        outlier_multiplier: row.outlier_multiplier ?? null,
        creator_handle: c.handle ?? null,
        creator_avatar_url: c.avatar_url ?? null,
      };
    });

  return NextResponse.json({ posts });
}
