/**
 * POST /api/voice/save-from-chat
 * Body: { chat_id: string }
 *
 * Turns a voice_build conversation into a saved voice card: reads the chat's
 * messages, runs Gemini voice extraction over the transcript, inserts a voice
 * row, and returns its id. Backs the "Save voice" button in voice_build chats.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import { extractVoiceFromChat } from "@/lib/extract-voice";
import { createVoiceRow } from "@/lib/voice-create";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { chat_id?: string };
  const chatId = body.chat_id;
  if (!chatId) {
    return NextResponse.json({ error: "chat_id required" }, { status: 400 });
  }

  const sb = getSupabase();

  // Verify the chat belongs to this workspace and is a voice build.
  const { data: chat } = await sb
    .from("chats")
    .select("id, workspace_id, context_kind")
    .eq("id", chatId)
    .maybeSingle();
  const c = chat as
    | { id: string; workspace_id: string; context_kind: string | null }
    | null;
  if (!c || c.workspace_id !== ws.workspaceId) {
    return NextResponse.json({ error: "chat not found" }, { status: 404 });
  }

  const { data: rows } = await sb
    .from("chat_messages")
    .select("role, content_md")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  const conversation = ((rows || []) as { role: string; content_md: string }[])
    .filter((m) => (m.content_md || "").trim().length > 0)
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content_md,
    }));

  const hasUser = conversation.some((m) => m.role === "user");
  if (!hasUser) {
    return NextResponse.json(
      { error: "Say a bit about your voice first, then save." },
      { status: 400 }
    );
  }

  try {
    const payload = await extractVoiceFromChat(conversation);
    const voiceId = await createVoiceRow(ws.workspaceId, payload);
    return NextResponse.json({ ok: true, voice_id: voiceId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
