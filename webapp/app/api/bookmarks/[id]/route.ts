/**
 * PATCH /api/bookmarks/[id] — notes, tags, canvas position
 * DELETE /api/bookmarks/[id]
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    notes_md?: string;
    tags?: string[];
    x?: number;
    y?: number;
    w?: number;
  };

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body.notes_md === "string") update.notes_md = body.notes_md;
  if (Array.isArray(body.tags)) update.tags = body.tags;
  if (typeof body.x === "number") update.x = body.x;
  if (typeof body.y === "number") update.y = body.y;
  if (typeof body.w === "number") update.w = body.w;

  const sb = getSupabase();
  const { error } = await sb
    .from("bookmark_items")
    .update(update)
    .eq("id", id)
    .eq("workspace_id", ws.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const sb = getSupabase();
  const { error } = await sb
    .from("bookmark_items")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ws.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
