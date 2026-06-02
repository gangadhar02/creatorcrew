/**
 * POST /api/bookmarks/add-url — add a single bookmark from a pasted permalink.
 * Body: { url: string, x?: number, y?: number }
 *
 * Fetches the post via Apify and upserts a bookmark_items row (dedup on
 * workspace_id + platform + external_id). Instagram only for now.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import { detectPlatform } from "@/lib/ingest/post-by-url";
import { fetchPostByUrlApify } from "@/lib/instagram-apify";
import { normalizePost } from "@/lib/instagram";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ error: "no workspace" }, { status: 401 });

  const body = (await request.json()) as {
    url?: string;
    x?: number;
    y?: number;
  };
  if (!body.url)
    return NextResponse.json({ error: "url required" }, { status: 400 });

  const platform = detectPlatform(body.url);
  if (platform !== "instagram") {
    return NextResponse.json(
      {
        error:
          platform === "x"
            ? "X/Twitter links aren't supported yet. Paste an Instagram post or reel link."
            : "Unrecognized link. Paste an Instagram post or reel URL.",
      },
      { status: 400 }
    );
  }

  let fetched;
  try {
    fetched = await fetchPostByUrlApify(body.url);
  } catch (e) {
    return NextResponse.json(
      { error: `Couldn't fetch: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }
  if (!fetched)
    return NextResponse.json(
      {
        error:
          "Couldn't fetch that post. It may be private, removed, or not a public Instagram post.",
      },
      { status: 502 }
    );

  const { profile, item } = fetched;
  const p = normalizePost(item);
  if (!p)
    return NextResponse.json({ error: "Unsupported post." }, { status: 422 });

  const media_type =
    item.media_type === 2 ? "video" : item.media_type === 8 ? "carousel" : "image";

  const sb = getSupabase();
  const { data, error } = await sb
    .from("bookmark_items")
    .upsert(
      {
        workspace_id: ws.workspaceId,
        platform: "instagram",
        external_id: p.media_pk,
        url: p.url,
        author_handle: profile.username || null,
        author_name: profile.full_name || null,
        caption: p.caption || null,
        thumbnail_url: p.thumbnail_url,
        media_type,
        saved_at: new Date().toISOString(),
        x: typeof body.x === "number" ? Math.round(body.x) : 0,
        y: typeof body.y === "number" ? Math.round(body.y) : 0,
        raw_json: item,
      },
      { onConflict: "workspace_id,platform,external_id" }
    )
    .select("id")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: (data as { id: string }).id });
}
