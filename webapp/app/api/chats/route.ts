/**
 * GET /api/chats — list workspace chats (recent first)
 */
import { NextResponse } from "next/server";
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
