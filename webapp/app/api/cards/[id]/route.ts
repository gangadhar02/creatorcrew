/**
 * PATCH /api/cards/[id] — update body_md / color
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
  const body = (await request.json()) as { body_md?: string; color?: string };
  const update: Record<string, unknown> = {};
  if ("body_md" in body) update.body_md = body.body_md || "";
  if ("color" in body) update.color = body.color || "gray";
  const sb = getSupabase();

  const { data: card } = await sb
    .from("cards")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", ws.workspaceId)
    .maybeSingle();
  if (!card)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  const { error } = await sb
    .from("cards")
    .update(update)
    .eq("id", id)
    .eq("workspace_id", ws.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
