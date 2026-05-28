/**
 * PATCH /api/board-items/[id]    — update tag / position
 * DELETE /api/board-items/[id]   — remove from board (cascades to card/document/file if exclusively owned)
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    tag?: string;
    position?: number;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
  };
  const update: Record<string, unknown> = {};
  if ("tag" in body) update.tag = body.tag || null;
  if (typeof body.position === "number") update.position = body.position;
  if (typeof body.x === "number") update.x = body.x;
  if (typeof body.y === "number") update.y = body.y;
  if (typeof body.w === "number") update.w = body.w;
  if (typeof body.h === "number") update.h = body.h;
  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "no fields" }, { status: 400 });
  const sb = getSupabase();
  const { error } = await sb.from("board_items").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const sb = getSupabase();
  const { error } = await sb.from("board_items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
