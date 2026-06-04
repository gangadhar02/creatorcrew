/**
 * POST /api/voice/build-chat
 *
 * Starts a guided "build your voice" conversation: creates a chat with
 * context_kind="voice_build", seeds the opening assistant message, and returns
 * the chat id so the client can navigate into it. The conversation itself
 * becomes the source material; the user later hits "Save voice" (which calls
 * /api/voice/save-from-chat) to turn it into a saved voice card.
 */
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENING = `This is a working conversation to shape your voice: your mission, your point of view, and the ideas you want to be known for. Nothing to prepare, and "I don't know" is a perfectly good answer. By the end you'll have a voice card you can actually use.

A few ways in, depending on how you like to work:

- **Walk me through it.** I'll pull the answers out of you with story-shaped questions. Best if you're not sure where to start.
- **Drop in writing you've already done.** A post, draft, thread, or transcript. Paste it here, @-mention a saved item, or open a board beside this chat, and I'll fingerprint the voice from it directly.
- **Tell me a specific thing** to add or change (a mission line, a stance, a word you love), and we'll go straight there.

To kick us off: tell me about one person you'd love to help right now. Who are they, what are they stuck on, and why does it bother you that they're stuck?`;

export async function POST() {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 401 });
  }
  const sb = getSupabase();

  const { data: chat, error } = await sb
    .from("chats")
    .insert({
      workspace_id: ws.workspaceId,
      title: "Build your voice",
      context_kind: "voice_build",
    })
    .select("id")
    .single();
  if (error || !chat) {
    return NextResponse.json(
      { error: error?.message || "could not create chat" },
      { status: 500 }
    );
  }
  const chatId = (chat as { id: string }).id;

  await sb.from("chat_messages").insert({
    chat_id: chatId,
    role: "assistant",
    content_md: OPENING,
  });

  return NextResponse.json({ chat_id: chatId });
}
