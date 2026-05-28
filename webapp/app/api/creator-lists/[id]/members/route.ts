/**
 * POST   /api/creator-lists/[id]/members      — add { creator_id }
 * DELETE /api/creator-lists/[id]/members?creator_id=<uuid>
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const { creator_id } = (await request.json()) as { creator_id?: string };
  if (!creator_id)
    return NextResponse.json({ error: "creator_id required" }, { status: 400 });
  const sb = getSupabase();
  const { error } = await sb
    .from("creator_list_members")
    .upsert(
      { list_id: id, creator_id },
      { onConflict: "list_id,creator_id" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-mark add_creator_to_list onboarding task complete
  const ws = await getWorkspaceContext();
  if (ws.workspaceId) {
    await sb
      .from("onboarding_progress")
      .upsert(
        {
          workspace_id: ws.workspaceId,
          task_key: "add_creator_to_list",
          completed_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,task_key" }
      );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const creator_id = request.nextUrl.searchParams.get("creator_id");
  if (!creator_id)
    return NextResponse.json({ error: "creator_id required" }, { status: 400 });
  const sb = getSupabase();
  const { error } = await sb
    .from("creator_list_members")
    .delete()
    .eq("list_id", id)
    .eq("creator_id", creator_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
