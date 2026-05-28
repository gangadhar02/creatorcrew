/**
 * GET  /api/pillars            — list pillars
 * POST /api/pillars            — create new pillar { name, color? }
 * DELETE /api/pillars?id=<uuid> — delete a pillar
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
    .from("pillars")
    .select("*")
    .eq("workspace_id", ws.workspaceId)
    .order("position", { ascending: true });
  return NextResponse.json({ pillars: data || [] });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { name?: string; color?: string };
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ error: "no workspace" }, { status: 500 });
  const sb = getSupabase();
  const { data, error } = await sb
    .from("pillars")
    .insert({
      workspace_id: ws.workspaceId,
      name: body.name.trim(),
      color: body.color || "gray",
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pillar: data });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const sb = getSupabase();
  const { error } = await sb.from("pillars").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
