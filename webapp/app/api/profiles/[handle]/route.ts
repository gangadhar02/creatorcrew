/**
 * DELETE /api/profiles/[handle]
 * Removes a profile (cascades to profile_posts).
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ handle: string }> }
) {
  const { handle } = await ctx.params;
  const sb = getSupabase();
  const ws = await getWorkspaceContext();
  const { error } = await sb
    .from("profiles")
    .delete()
    .eq("ig_handle", handle.toLowerCase())
    .eq("workspace_id", ws.workspaceId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
