"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Maximize2, X as XIcon, Plus, LayoutGrid } from "lucide-react";
import ChatThread from "./ChatThread";
import { setPendingChat } from "@/lib/pending-chat";
import type { Chat } from "@/lib/types-chat";
import type { ChatTarget } from "./post-chat";

/**
 * Unified docked chat panel. Creates a chat for the given target (post / board /
 * freeform) and renders the shared ChatThread. The board/post system prompts on
 * the server already load full context, so the model is context-aware.
 *
 * AppShell keys this by target, so switching targets remounts it (fresh chat);
 * the in-component "new chat" button bumps a nonce to start a new thread.
 */
export default function ChatPanel({
  target,
  onClose,
}: {
  target: ChatTarget;
  onClose: () => void;
}) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const startedRef = useRef(-1);

  useEffect(() => {
    if (startedRef.current === nonce) return;
    startedRef.current = nonce;
    setChat(null);
    setError(null);
    (async () => {
      try {
        const body =
          target.kind === "post"
            ? {
                title: target.handle ? `Chat with @${target.handle}` : "Chat about post",
                context_kind: "creator_post",
                context_id: target.postId,
              }
            : target.kind === "board"
              ? { title: `Chat · ${target.boardName}`, context_kind: "board", context_id: target.boardId }
              : { title: "New chat", context_kind: "freeform" };
        const res = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as { chat?: Chat; error?: string };
        if (!res.ok || !data.chat) throw new Error(data.error || `HTTP ${res.status}`);
        if (target.kind === "post") {
          setPendingChat(data.chat.id, {
            message:
              "Give me a short, sharp read on this post: what's the hook, why it works, and one idea to remix it. Then I'll ask follow-ups.",
          });
        }
        setChat(data.chat);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, [target, nonce]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title =
    target.kind === "board" ? (
      <span className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
        <LayoutGrid className="h-3 w-3 text-muted-foreground" />
        <span className="max-w-[150px] truncate">{target.boardName}</span>
      </span>
    ) : target.kind === "post" ? (
      <span className="truncate text-sm font-medium">
        {target.handle ? `Chat with @${target.handle}` : "Chat about post"}
      </span>
    ) : (
      <span className="text-sm font-medium">New chat</span>
    );

  const iconBtn =
    "grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        {title}
        <div className="flex-1" />
        <button onClick={() => setNonce((n) => n + 1)} title="New chat" className={iconBtn}>
          <Plus className="h-4 w-4" />
        </button>
        {chat && (
          <Link href={`/chats/${chat.id}`} title="Open full chat" className={iconBtn}>
            <Maximize2 className="h-3.5 w-3.5" />
          </Link>
        )}
        <button onClick={onClose} title="Close (Esc)" className={iconBtn}>
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {error ? (
          <div className="grid h-full place-items-center p-6 text-center text-sm text-destructive">
            Couldn&apos;t start chat. {error}
          </div>
        ) : chat ? (
          <ChatThread key={chat.id} chat={chat} initialMessages={[]} embedded />
        ) : (
          <div className="grid h-full place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
