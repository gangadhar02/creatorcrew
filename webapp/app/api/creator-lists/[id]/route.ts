/**
 * GET    /api/creator-lists/[id]  — list detail with members
 * PATCH  /api/creator-lists/[id]  — update name/description/color
 * DELETE /api/creator-lists/[id]
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const sb = getSupabase();
  const { data: list } = await sb
    .from("creator_lists")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ws.workspaceId)
    .maybeSingle();
  if (!list) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data: members } = await sb
    .from("creator_list_members")
    .select("creator:creators(*)")
    .eq("list_id", id);
  return NextResponse.json({
    list,
    members: (members || []).map(
      (m) => (m as { creator: unknown }).creator
    ),
  });
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await request.json()) as Record<string, unknown>;
  const allowed = ["name", "description", "color", "position"];
  const update: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) update[k] = body[k];
  }
  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "no fields" }, { status: 400 });
  const sb = getSupabase();
  const { error } = await sb
    .from("creator_lists")
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
    .from("creator_lists")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ws.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
