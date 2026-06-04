/**
 * POST /api/documents — create a standalone document
 * Body: { title?, body_md?, voice_id? }
 * Returns: { document: { id, ... } }
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    body_md?: string;
    voice_id?: string | null;
  };
  const sb = getSupabase();
  const { data, error } = await sb
    .from("documents")
    .insert({
      workspace_id: ws.workspaceId,
      title: body.title?.trim() || "Untitled document",
      body_md: body.body_md || "",
      voice_id: body.voice_id || null,
    })
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data });
}
