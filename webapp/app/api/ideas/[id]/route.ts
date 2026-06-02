/**
 * PATCH /api/ideas/[id]
 * Body: a partial ContentIdea — typically { body_md, outline_md, ig_breakdown_md,
 * x_breakdown_md, youtube_breakdown_md, name, angle, status }
 *
 * Used by the TipTap editor to save inline edits.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

const ALLOWED_KEYS = new Set([
  "name",
  "angle",
  "pillar",
  "priority",
  "format",
  "platforms",
  "hook_curiosity",
  "hook_value",
  "hook_emotional",
  "outline_md",
  "ig_breakdown_md",
  "x_breakdown_md",
  "youtube_breakdown_md",
  "body_md",
  "week_of",
  "status",
]);

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json()) as Record<string, unknown>;

  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_KEYS.has(k)) update[k] = v;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no allowed fields in body" }, { status: 400 });
  }
  const sb = getSupabase();
  const ws = await getWorkspaceContext();
  const { error } = await sb
    .from("content_ideas")
    .update(update)
    .eq("id", id)
    .eq("workspace_id", ws.workspaceId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
