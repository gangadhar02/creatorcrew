/**
 * POST /api/bookmarks/sync
 * Body: { maxPerPlatform?: number, autoTag?: boolean }
 *
 * Fetches IG + X bookmarks (cookies), upserts, auto-tags with Gemini, auto-layouts.
 */
import { NextResponse, type NextRequest } from "next/server";
import { syncAllBookmarks } from "@/lib/bookmarks-store";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    maxPerPlatform?: number;
    autoTag?: boolean;
  };

  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncAllBookmarks(ws.workspaceId, {
      maxPerPlatform: body.maxPerPlatform,
      autoTag: body.autoTag,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = String(e);
    if (msg.includes("bookmark_items") || msg.includes("does not exist")) {
      return NextResponse.json(
        {
          error:
            "bookmark_items table missing. Run docs/bookmarks-schema.sql in Supabase SQL editor.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
