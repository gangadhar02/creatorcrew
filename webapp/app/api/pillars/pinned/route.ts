/**
 * GET    /api/pillars/pinned — list workspace-pinned taxonomy pillars
 * POST   /api/pillars/pinned — { taxonomy_id } pin a pillar
 * DELETE /api/pillars/pinned?taxonomy_id=… — unpin
 *
 * Pinning the FIRST pillar auto-creates the adaptive "For you" creator_list
 * (matches Eden's behavior). The list's membership is computed dynamically
 * at query time from `workspace_pinned_pillars`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) return NextResponse.json({ pillars: [] });
  const sb = getSupabase();
  const { data } = await sb
    .from("workspace_pinned_pillars")
    .select(`taxonomy_id, position, pinned_at,
             taxonomy:pillar_taxonomy(taxonomy_id, label, tier1, icon, color)`)
    .eq("workspace_id", ws.workspaceId)
    .order("position", { ascending: true });
  return NextResponse.json({ pillars: data || [] });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { taxonomy_id?: string };
  if (!body.taxonomy_id)
    return NextResponse.json(
      { error: "taxonomy_id required" },
      { status: 400 }
    );
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ error: "no workspace" }, { status: 500 });
  const sb = getSupabase();

  // Check if any pillars are pinned — if not, create the adaptive list.
  const { count } = await sb
    .from("workspace_pinned_pillars")
    .select("taxonomy_id", { count: "exact", head: true })
    .eq("workspace_id", ws.workspaceId);

  const { error } = await sb
    .from("workspace_pinned_pillars")
    .upsert(
      { workspace_id: ws.workspaceId, taxonomy_id: body.taxonomy_id },
      { onConflict: "workspace_id,taxonomy_id" }
    );
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  if ((count || 0) === 0) {
    await sb
      .from("creator_lists")
      .upsert(
        {
          workspace_id: ws.workspaceId,
          name: "For you",
          emoji: "✨",
          kind: "adaptive",
          color: "purple",
          position: -1000,
        },
        { onConflict: "workspace_id,name", ignoreDuplicates: true }
      );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const taxonomyId = request.nextUrl.searchParams.get("taxonomy_id");
  if (!taxonomyId)
    return NextResponse.json(
      { error: "taxonomy_id required" },
      { status: 400 }
    );
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ error: "no workspace" }, { status: 500 });
  const sb = getSupabase();
  await sb
    .from("workspace_pinned_pillars")
    .delete()
    .eq("workspace_id", ws.workspaceId)
    .eq("taxonomy_id", taxonomyId);
  return NextResponse.json({ ok: true });
}
