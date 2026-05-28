/**
 * GET /api/bookmarks — list bookmark canvas items for the workspace.
 */
import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { listBookmarks } from "@/lib/bookmarks-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) {
    return NextResponse.json({ items: [] });
  }
  try {
    const items = await listBookmarks(ws.workspaceId);
    return NextResponse.json({ items });
  } catch (e) {
    const msg = String(e);
    if (msg.includes("bookmark_items") || msg.includes("does not exist")) {
      return NextResponse.json(
        {
          error:
            "bookmark_items table missing. Run docs/bookmarks-schema.sql in Supabase.",
          items: [],
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
