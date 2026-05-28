/**
 * POST /api/post-seen/[id] — mark a creator_post as seen by current workspace.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ error: "no workspace" }, { status: 500 });
  const sb = getSupabase();
  const { error } = await sb
    .from("post_seen")
    .upsert(
      { workspace_id: ws.workspaceId, post_id: id, viewed_at: new Date().toISOString() },
      { onConflict: "workspace_id,post_id" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
