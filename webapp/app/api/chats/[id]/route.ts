/**
 * GET    /api/chats/[id]  — chat + messages
 * PATCH  /api/chats/[id]  — rename / change voice
 * DELETE /api/chats/[id]
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

const ALLOWED = ["title", "voice_id"];

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const sb = getSupabase();
  const { data: chat } = await sb
    .from("chats")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!chat) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data: messages } = await sb
    .from("chat_messages")
    .select("*")
    .eq("chat_id", id)
    .order("created_at", { ascending: true });
  return NextResponse.json({ chat, messages: messages || [] });
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json()) as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  for (const k of ALLOWED) {
    if (k in body) update[k] = body[k];
  }
  const sb = getSupabase();
  const { error } = await sb.from("chats").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const sb = getSupabase();
  const { error } = await sb.from("chats").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
