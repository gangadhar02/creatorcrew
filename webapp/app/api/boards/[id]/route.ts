/**
 * GET    /api/boards/[id] — board + items expanded
 * PATCH  /api/boards/[id]
 * DELETE /api/boards/[id]
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

const ALLOWED = [
  "name",
  "description",
  "color",
  "icon",
  "voice_id",
  "position",
  "canvas_state",
];

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const sb = getSupabase();
  const { data: board } = await sb
    .from("boards")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: items } = await sb
    .from("board_items")
    .select(
      `*,
       creator_post:creator_posts(*, creator:creators(*)),
       card:cards(*),
       document:documents(*),
       file:files(*)
      `
    )
    .eq("board_id", id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  return NextResponse.json({ board, items: items || [] });
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json()) as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  for (const k of ALLOWED) {
    if (k in body) update[k] = body[k];
  }
  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "no fields" }, { status: 400 });
  const sb = getSupabase();
  const { error } = await sb.from("boards").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const sb = getSupabase();
  const { error } = await sb.from("boards").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
