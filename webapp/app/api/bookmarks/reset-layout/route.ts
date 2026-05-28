/**
 * POST /api/bookmarks/reset-layout
 *
 * Reflow every bookmark in the workspace into a clean 5-column grid in
 * `saved_at desc` order. Overrides any existing x/y. Use this when you want
 * to wipe out hand-arranged or tag-clustered positions and start fresh.
 */
import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { getSupabase } from "@/lib/supabase";
import { listBookmarks } from "@/lib/bookmarks-store";

export const runtime = "nodejs";

const COLS = 5;
const COL_STEP = 320;
// Rows are sized to fit the tallest cards (Instagram, ~620px with 4:5 image +
// caption + notes editor). X cards are shorter so leave more whitespace, but
// nothing overlaps. For tighter packing, masonry it after measure.
const ROW_STEP = 680;

export async function POST() {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  try {
    const items = await listBookmarks(ws.workspaceId);
    const sb = getSupabase();
    const now = new Date().toISOString();

    let updated = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const x = (i % COLS) * COL_STEP;
      const y = Math.floor(i / COLS) * ROW_STEP;
      const { error } = await sb
        .from("bookmark_items")
        .update({ x, y, updated_at: now })
        .eq("id", item.id);
      if (!error) updated++;
    }

    return NextResponse.json({ ok: true, updated, count: items.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
