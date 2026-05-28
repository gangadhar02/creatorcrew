import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import type { Chat, ChatMessage } from "@/lib/types-chat";
import ChatThread from "@/components/ChatThread";

export const dynamic = "force-dynamic";

export default async function ChatDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = getSupabase();

  const { data: chatRow } = await sb
    .from("chats")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const chat = chatRow as Chat | null;
  if (!chat) notFound();

  const { data: msgs } = await sb
    .from("chat_messages")
    .select("*")
    .eq("chat_id", id)
    .order("created_at", { ascending: true });

  return <ChatThread chat={chat} initialMessages={(msgs || []) as ChatMessage[]} />;
}
