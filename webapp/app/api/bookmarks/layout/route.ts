/**
 * POST /api/bookmarks/layout — re-run auto-layout for all bookmarks in workspace.
 */
import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { applyTagsAndLayout, listBookmarks } from "@/lib/bookmarks-store";

export const runtime = "nodejs";

export async function POST() {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }
  try {
    await applyTagsAndLayout(ws.workspaceId, new Map());
    const items = await listBookmarks(ws.workspaceId);
    return NextResponse.json({ ok: true, count: items.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
