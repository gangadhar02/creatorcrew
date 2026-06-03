/**
 * In-memory handoff for the first message of a freshly-created chat.
 *
 * The home composer creates an empty chat, stashes the typed prompt here keyed
 * by the new chat id, then client-side-navigates to /chats/[id]. ChatThread
 * picks it up on mount and fires it through the normal streaming send() so the
 * answer renders live in place. Using a module singleton (not query params /
 * sessionStorage) keeps File-derived base64 attachments intact and survives the
 * SPA navigation. A hard reload before the prompt fires simply drops it, leaving
 * an empty chat — harmless, since nothing was persisted yet.
 */
import type { ChatAttachment } from "@/lib/chat-files";

export type PendingMention = { kind: "post" | "creator" | "list"; id: string; label: string };

export type PendingChat = {
  message: string;
  mentions?: PendingMention[];
  attachments?: ChatAttachment[];
};

const store = new Map<string, PendingChat>();

export function setPendingChat(chatId: string, payload: PendingChat): void {
  store.set(chatId, payload);
}

/** Read and remove the pending payload for a chat (single-use). */
export function takePendingChat(chatId: string): PendingChat | null {
  const value = store.get(chatId);
  if (value) store.delete(chatId);
  return value ?? null;
}
