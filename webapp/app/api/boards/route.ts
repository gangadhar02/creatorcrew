/**
 * GET  /api/boards         — list workspace boards
 * POST /api/boards         — create board { name, description?, color?, voice_id?, copy_from_template_id? }
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) return NextResponse.json({ boards: [] });
  const sb = getSupabase();
  const { data } = await sb
    .from("boards")
    .select("*")
    .eq("workspace_id", ws.workspaceId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  return NextResponse.json({ boards: data || [] });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    name?: string;
    description?: string;
    color?: string;
    voice_id?: string | null;
    copy_from_template_id?: string;
  };
  if (!body.name?.trim())
    return NextResponse.json({ error: "name required" }, { status: 400 });
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ error: "no workspace" }, { status: 500 });
  const sb = getSupabase();

  const { data, error } = await sb
    .from("boards")
    .insert({
      workspace_id: ws.workspaceId,
      name: body.name.trim(),
      description: body.description || null,
      color: body.color || "gray",
      voice_id: body.voice_id || null,
      kind: "board",
      parent_template_id: body.copy_from_template_id || null,
    })
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  // Mark create_board onboarding task complete
  await sb
    .from("onboarding_progress")
    .upsert(
      {
        workspace_id: ws.workspaceId,
        task_key: "create_board",
        completed_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,task_key" }
    );

  return NextResponse.json({ board: data });
}
