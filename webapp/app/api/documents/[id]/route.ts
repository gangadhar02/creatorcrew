/**
 * PATCH /api/documents/[id] — update title / body_md / voice_id
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

const ALLOWED = ["title", "body_md", "voice_id"];

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await request.json()) as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  for (const k of ALLOWED) {
    if (k in body) update[k] = body[k];
  }
  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "no fields" }, { status: 400 });
  const sb = getSupabase();

  const { data: doc } = await sb
    .from("documents")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", ws.workspaceId)
    .maybeSingle();
  if (!doc)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  const { error } = await sb
    .from("documents")
    .update(update)
    .eq("id", id)
    .eq("workspace_id", ws.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
