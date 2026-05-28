/**
 * PATCH /api/cards/[id] — update body_md / color
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json()) as { body_md?: string; color?: string };
  const update: Record<string, unknown> = {};
  if ("body_md" in body) update.body_md = body.body_md || "";
  if ("color" in body) update.color = body.color || "gray";
  const sb = getSupabase();
  const { error } = await sb.from("cards").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
