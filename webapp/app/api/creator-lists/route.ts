/**
 * GET  /api/creator-lists           — list workspace's lists with member counts
 * POST /api/creator-lists           — create a list { name, description?, color? }
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) return NextResponse.json({ lists: [] });
  const sb = getSupabase();

  const { data: lists } = await sb
    .from("creator_lists")
    .select("*")
    .eq("workspace_id", ws.workspaceId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  // Pull member counts in one go
  const ids = ((lists || []) as { id: string }[]).map((l) => l.id);
  const counts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: members } = await sb
      .from("creator_list_members")
      .select("list_id")
      .in("list_id", ids);
    for (const m of (members || []) as { list_id: string }[]) {
      counts[m.list_id] = (counts[m.list_id] || 0) + 1;
    }
  }
  const withCounts = (lists || []).map((l) => {
    const lst = l as { id: string };
    return { ...l, member_count: counts[lst.id] || 0 };
  });

  return NextResponse.json({ lists: withCounts });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    name?: string;
    description?: string;
    color?: string;
  };
  if (!body.name || !body.name.trim())
    return NextResponse.json({ error: "name required" }, { status: 400 });
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ error: "no workspace" }, { status: 500 });
  const sb = getSupabase();
  const { data, error } = await sb
    .from("creator_lists")
    .insert({
      workspace_id: ws.workspaceId,
      name: body.name.trim(),
      description: body.description || null,
      color: body.color || "gray",
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ list: data });
}
