/**
 * DELETE /api/creators/[id]
 *
 * Removes a creator from the current workspace. Cascades automatically:
 *   - creator_posts (ON DELETE CASCADE via creator_id FK)
 *   - creator_list_members (ON DELETE CASCADE)
 *   - outlier_baselines (ON DELETE CASCADE)
 *
 * Workspace-scoped: rejects deletes for creators that don't belong to
 * the caller's workspace.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing creator id" }, { status: 400 });
  }

  const sb = getSupabase();

  // Sanity-check ownership before deleting (service-role bypasses RLS).
  const ownerRes = await sb
    .from("creators")
    .select("workspace_id, handle, platform")
    .eq("id", id)
    .maybeSingle();
  const owner = ownerRes.data as
    | { workspace_id: string; handle: string; platform: string }
    | null;

  if (!owner) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }
  if (owner.workspace_id !== ws.workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await sb.from("creators").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    deleted: { id, handle: owner.handle, platform: owner.platform },
  });
}
