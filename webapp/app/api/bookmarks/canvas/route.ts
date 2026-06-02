/**
 * GET    /api/bookmarks/canvas — the workspace's tldraw canvas snapshot
 * PUT    /api/bookmarks/canvas — upsert the snapshot
 * DELETE /api/bookmarks/canvas — clear it (re-seeds from a fresh grid)
 *
 * The bookmarks canvas is a single per-workspace surface, stored in
 * `bookmark_canvas` (migration_022).
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET() {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) return NextResponse.json({ canvas_state: null });
  const sb = getSupabase();
  const { data } = await sb
    .from("bookmark_canvas")
    .select("canvas_state")
    .eq("workspace_id", ws.workspaceId)
    .maybeSingle();
  return NextResponse.json({ canvas_state: data?.canvas_state ?? null });
}

export async function PUT(request: NextRequest) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ error: "no workspace" }, { status: 401 });
  const body = (await request.json()) as { canvas_state?: unknown };
  if (!("canvas_state" in body))
    return NextResponse.json({ error: "no canvas_state" }, { status: 400 });
  const sb = getSupabase();
  const { error } = await sb.from("bookmark_canvas").upsert(
    {
      workspace_id: ws.workspaceId,
      canvas_state: body.canvas_state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ error: "no workspace" }, { status: 401 });
  const sb = getSupabase();
  const { error } = await sb
    .from("bookmark_canvas")
    .delete()
    .eq("workspace_id", ws.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
