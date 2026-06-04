// GET /api/posts/[id]/video
// Returns a directly-playable video URL for a creator_post, parsed from its
// stored raw_json (IG video_versions / X variants). Used by PostDetailModal to
// play reels natively instead of relying on Instagram's embed iframe, which
// shows a non-interactive "Watch on Instagram" poster for some accounts' reels.
//
// Returns: { videoUrl: string | null }  (null = no playable video; caller falls
// back to the IG embed / thumbnail). Workspace-scoped via the creators join.
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import { bookmarkVideoUrl } from "@/lib/bookmark-media-parse";
import type { BookmarkItem } from "@/lib/types-bookmarks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) return NextResponse.json({ videoUrl: null });

  const { id } = await params;
  if (!id) return NextResponse.json({ videoUrl: null });

  const sb = getSupabase();
  const { data } = await sb
    .from("creator_posts")
    .select("id, platform, url, raw_json, creator:creators!inner(workspace_id)")
    .eq("id", id)
    .eq("creator.workspace_id", ws.workspaceId)
    .maybeSingle();

  if (!data) return NextResponse.json({ videoUrl: null });

  const row = data as {
    platform: string;
    url: string;
    raw_json?: Record<string, unknown> | null;
  };
  const videoUrl = row.raw_json
    ? bookmarkVideoUrl({
        platform: row.platform,
        url: row.url,
        raw_json: row.raw_json,
      } as BookmarkItem)
    : null;
  return NextResponse.json({ videoUrl });
}
