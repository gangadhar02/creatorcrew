"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, ExternalLink, X as XIcon } from "lucide-react";
import ChatThread from "./ChatThread";
import { setPendingChat } from "@/lib/pending-chat";
import type { Chat } from "@/lib/types-chat";

/**
 * Docked, split-screen chat panel for a single post. Rendered by AppShell on the
 * right edge while the main content reflows to make room. Creates an empty
 * post-context chat, hands the opening prompt to ChatThread via the in-memory
 * pending-chat handoff, and streams the reply client-side (same path as the home
 * composer) so the answer actually renders.
 */
export default function PostChatPanel({
  postId,
  handle,
  onClose,
}: {
  postId: string;
  handle?: string | null;
  onClose: () => void;
}) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create the chat when this panel mounts (AppShell remounts it per post by
  // keying on postId), then seed the opening prompt and let ChatThread stream.
  //
  // startedRef dedupes the creation so React Strict Mode's double-invoked effect
  // (dev) doesn't create two chats. We deliberately do NOT cancel the state
  // update on cleanup: Strict Mode's preserved ref would skip the second run,
  // and a cancel flag would then leave the panel stuck on the spinner forever.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: handle ? `Chat with @${handle}` : "Chat about post",
            context_kind: "creator_post",
            context_id: postId,
          }),
        });
        const data = (await res.json()) as { chat?: Chat; error?: string };
        if (!res.ok || !data.chat) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        setPendingChat(data.chat.id, {
          message:
            "Give me a short, sharp read on this post: what's the hook, why it works, and one idea to remix it. Then I'll ask follow-ups.",
        });
        setChat(data.chat);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, [postId, handle]);

  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1 truncate text-sm font-medium">
          {handle ? `Chat with @${handle}` : "Chat about post"}
        </div>
        {chat && (
          <Link
            href={`/chats/${chat.id}`}
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground"
            title="Open full chat"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open
          </Link>
        )}
        <button
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Close (Esc)"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {error ? (
          <div className="grid h-full place-items-center p-6 text-center text-sm text-destructive">
            Couldn&apos;t start chat. {error}
          </div>
        ) : chat ? (
          <ChatThread chat={chat} initialMessages={[]} embedded />
        ) : (
          <div className="grid h-full place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
