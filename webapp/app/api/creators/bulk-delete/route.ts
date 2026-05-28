/**
 * POST /api/creators/bulk-delete
 * Body: { ids: string[] }
 *
 * Workspace-scoped bulk delete. Filters out any creator ids that don't
 * belong to the caller's workspace so a malicious client can't pass in
 * other people's creator ids. Cascades to creator_posts, list members,
 * outlier_baselines, etc via existing FK ON DELETE CASCADE.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 401 });
  }

  const { ids } = (await request.json()) as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: "ids must be a non-empty array" },
      { status: 400 }
    );
  }
  if (ids.length > 500) {
    return NextResponse.json(
      { error: "Max 500 creators per bulk delete" },
      { status: 400 }
    );
  }

  const sb = getSupabase();

  // Restrict the delete set to creators owned by this workspace.
  const ownedRes = await sb
    .from("creators")
    .select("id")
    .eq("workspace_id", ws.workspaceId)
    .in("id", ids);
  const owned = ((ownedRes.data || []) as { id: string }[]).map((r) => r.id);

  if (owned.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0, requested: ids.length });
  }

  const { error } = await sb.from("creators").delete().in("id", owned);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    deleted: owned.length,
    requested: ids.length,
    skipped: ids.length - owned.length,
  });
}
