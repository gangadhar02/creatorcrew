/**
 * GET  /api/chats: list workspace chats (recent first)
 * POST /api/chats: create an empty chat (no message / no generation) and
 *                   return it. The home composer uses this to get a chat id to
 *                   navigate to before streaming the first message in place.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) return NextResponse.json({ chats: [] });
  const sb = getSupabase();
  const { data } = await sb
    .from("chats")
    .select("*")
    .eq("workspace_id", ws.workspaceId)
    .order("updated_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ chats: data || [] });
}

export async function POST(request: NextRequest) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) {
    return NextResponse.json({ error: "no workspace" }, { status: 500 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    context_kind?: string;
    context_id?: string;
    voice_id?: string | null;
  };
  const sb = getSupabase();
  const { data, error } = await sb
    .from("chats")
    .insert({
      workspace_id: ws.workspaceId,
      title: (body.title?.trim() || "New chat").slice(0, 80),
      context_kind: body.context_kind || "freeform",
      context_id: body.context_id || null,
      voice_id: body.voice_id || null,
    })
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "create failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ chat: data });
}
