"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Send, X } from "lucide-react";
import ChatRow from "./ChatRow";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Chat, ChatMessage } from "@/lib/types-chat";
import MarkdownView from "./MarkdownView";
import MentionAutocomplete, { type MentionHit } from "./MentionAutocomplete";
import VariationsCardList from "./VariationsCardList";
import type { ShowBoostVariationsArgs } from "@/lib/tools";
import { readNdjsonStream } from "@/lib/chat-stream";

type Mention = { kind: "post" | "creator" | "list"; id: string; label: string };

export default function ChatThread({
  chat,
  initialMessages,
}: {
  chat: Chat;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const title = chat.title;
  const [pendingMentions, setPendingMentions] = useState<Mention[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // Detect @-mention typing
  useEffect(() => {
    if (!inputRef.current) return;
    const ta = inputRef.current;
    const before = input.slice(0, ta.selectionStart);
    const match = before.match(/@(\w*)$/);
    setMentionQuery(match ? match[1] : null);
  }, [input]);

  function insertMention(hit: MentionHit) {
    if (!inputRef.current) return;
    const ta = inputRef.current;
    const cursor = ta.selectionStart;
    const before = input.slice(0, cursor);
    const after = input.slice(cursor);
    const newBefore = before.replace(/@(\w*)$/, `@${hit.label} `);
    setInput(newBefore + after);
    setPendingMentions((m) => [...m, { kind: hit.kind, id: hit.id, label: hit.label }]);
    setMentionQuery(null);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const pos = newBefore.length;
        inputRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    const userTempId = `tmp-user-${Date.now()}`;
    const assistantTempId = `tmp-assist-${Date.now()}`;
    setStreaming(true);
    setStreamingMessageId(assistantTempId);
    setInput("");
    const mentions = pendingMentions;
    setPendingMentions([]);

    // Optimistic user message
    setMessages((m) => [
      ...m,
      {
        id: userTempId,
        chat_id: chat.id,
        role: "user",
        content_md: text,
        thoughts_md: null,
        tool_calls: null,
        attached_item_ids: null,
        mentions: mentions.length > 0 ? { items: mentions } : null,
        created_at: new Date().toISOString(),
      },
      {
        id: assistantTempId,
        chat_id: chat.id,
        role: "assistant",
        content_md: "",
        thoughts_md: null,
        tool_calls: null,
        attached_item_ids: null,
        mentions: null,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chat.id,
          message: text,
          mentions: mentions.length > 0 ? mentions : undefined,
        }),
      });
      if (!res.body) throw new Error("no response body");

      let gotAssistantContent = false;
      await readNdjsonStream<
        | { type: "start"; chat_id: string }
        | { type: "token"; text: string }
        | { type: "tool-call"; name: string; args: unknown }
        | { type: "reasoning-delta"; delta: string }
        | { type: "complete"; message_id: string; content: string }
        | { type: "error"; message: string }
      >(res.body, (ev) => {
        if (ev.type === "token") {
          gotAssistantContent = true;
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantTempId
                ? { ...msg, content_md: msg.content_md + ev.text }
                : msg
            )
          );
        } else if (ev.type === "tool-call") {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantTempId
                ? {
                    ...msg,
                    tool_calls: [
                      ...((msg.tool_calls as
                        | { name: string; args: unknown }[]
                        | null) || []),
                      { name: ev.name, args: ev.args },
                    ],
                  }
                : msg
            )
          );
        } else if (ev.type === "reasoning-delta") {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantTempId
                ? {
                    ...msg,
                    thoughts_md: (msg.thoughts_md || "") + ev.delta,
                  }
                : msg
            )
          );
        } else if (ev.type === "complete") {
          gotAssistantContent = true;
          setStreamingMessageId(ev.message_id);
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantTempId
                ? { ...msg, id: ev.message_id, content_md: ev.content }
                : msg
            )
          );
        } else if (ev.type === "error") {
          setMessages((m) => [
            ...m.filter((msg) => msg.id !== assistantTempId),
            {
              id: `err-${Date.now()}`,
              chat_id: chat.id,
              role: "system",
              content_md: `Error: ${ev.message}`,
              thoughts_md: null,
              tool_calls: null,
              attached_item_ids: null,
              mentions: null,
              created_at: new Date().toISOString(),
            },
          ]);
        }
      });

      if (!gotAssistantContent) {
        const reload = await fetch(`/api/chats/${chat.id}`);
        if (reload.ok) {
          const data = (await reload.json()) as { messages?: ChatMessage[] };
          if (data.messages?.length) setMessages(data.messages);
        }
      }
    } catch (e) {
      setMessages((m) => [
        ...m.filter((msg) => msg.id !== assistantTempId),
        {
          id: `err-${Date.now()}`,
          chat_id: chat.id,
          role: "system",
          content_md: `Stream failed: ${e}`,
          thoughts_md: null,
          tool_calls: null,
          attached_item_ids: null,
          mentions: null,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setStreaming(false);
      setStreamingMessageId(null);
    }
  }

  return (
    <div className="-mx-6 -my-8 flex flex-col lg:-mx-8 lg:-my-10" style={{ minHeight: "100svh" }}>
      {/* Slim title bar */}
      <div className="flex h-10 shrink-0 items-center border-b border-border/50 px-6">
        <ChatTitlePicker currentChatId={chat.id} title={title} />
      </div>

      {/* Messages — grows, then composer is pinned below */}
      <div className="flex flex-1 flex-col items-center px-6 pb-6 pt-10">
        <div className="w-full max-w-2xl space-y-8">
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                m={m}
                streaming={streamingMessageId === m.id}
              />
            ))}
          </AnimatePresence>
          <div ref={endRef} />
        </div>
      </div>

      {/* Composer — sticky at bottom */}
      <div className="sticky bottom-0 flex justify-center bg-gradient-to-t from-background via-background/95 to-transparent px-6 pb-5 pt-4">
        <div className="w-full max-w-2xl">
          <div className="relative rounded-2xl border border-border/80 bg-card/95 p-2 shadow-[0_14px_60px_-34px_rgba(0,0,0,0.65)] backdrop-blur-xl transition-shadow focus-within:shadow-[0_18px_70px_-34px_rgba(0,0,0,0.75)]">
            {pendingMentions.length > 0 && (
              <div className="mb-1 flex flex-wrap items-center gap-1 px-8">
                {pendingMentions.map((m, i) => (
                  <Badge
                    key={`${m.kind}-${m.id}`}
                    variant="secondary"
                    className="gap-1 pl-2 pr-1 text-[10px] font-normal"
                  >
                    @{m.label}
                    <button
                      type="button"
                      onClick={() =>
                        setPendingMentions((p) => p.filter((_, idx) => idx !== i))
                      }
                      className="rounded-sm p-0.5 text-muted-foreground hover:bg-background/40 hover:text-foreground"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="mb-0.5 rounded-full text-muted-foreground"
                title="Attach context"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    (e.metaKey || e.ctrlKey) &&
                    e.key === "Enter" &&
                    mentionQuery === null
                  ) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask anything…"
                rows={1}
                disabled={streaming}
                className="min-h-9 resize-none border-0 bg-transparent px-0 py-2 text-sm shadow-none focus-visible:ring-0"
              />
              <Button
                onClick={send}
                disabled={streaming || !input.trim()}
                size="icon-sm"
                className="mb-0.5 rounded-full"
                title="Send"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>

            <AnimatePresence>
              {mentionQuery !== null && (
                <MentionAutocomplete
                  query={mentionQuery}
                  onPick={insertMention}
                  onClose={() => setMentionQuery(null)}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  m,
  streaming,
}: {
  m: ChatMessage;
  streaming?: boolean;
}) {
  if (m.role === "system") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-rose-300 bg-rose-50/50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300"
      >
        {m.content_md}
      </motion.div>
    );
  }
  const isUser = m.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={isUser ? "flex justify-end" : "flex justify-start"}
    >
      <div
        className={cn(
          "max-w-[85%]",
          isUser
            ? "rounded-2xl bg-card px-3 py-2 text-sm shadow-[0_10px_35px_-25px_rgba(0,0,0,0.7)] ring-1 ring-border/70"
            : "text-sm leading-relaxed text-foreground"
        )}
      >
        {m.thoughts_md && (
          <details className="mb-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">
              Thoughts ▾
            </summary>
            <div className="mt-1 opacity-80">
              <MarkdownView>{m.thoughts_md}</MarkdownView>
            </div>
          </details>
        )}
        {isUser ? (
          <div className="whitespace-pre-wrap">{m.content_md}</div>
        ) : (
          <>
            {/* Tool-call renderings (showBoostVariations etc.) */}
            {Array.isArray(m.tool_calls) &&
              m.tool_calls.map((tc, i) => {
                if (tc.name === "showBoostVariations") {
                  const args = tc.args as ShowBoostVariationsArgs;
                  if (Array.isArray(args?.variations)) {
                    return (
                      <div key={i} className="my-2">
                        <VariationsCardList variations={args.variations} />
                      </div>
                    );
                  }
                }
                return null;
              })}

            {m.content_md ? (
              <div>
                <MarkdownView>{stripToolBlocks(m.content_md)}</MarkdownView>
                {streaming && (
                  <span className="inline-block h-3 w-1.5 ml-0.5 bg-muted-foreground animate-pulse align-middle" />
                )}
              </div>
            ) : streaming ? (
              <RotatingStatus />
            ) : null}
          </>
        )}
      </div>
    </motion.div>
  );
}

function ChatTitlePicker({
  currentChatId,
  title,
}: {
  currentChatId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [chats, setChats] = useState<Array<{ id: string; title: string; updated_at?: string }>>(
    []
  );

  useEffect(() => {
    if (!open) return;
    if (chats.length > 0) return;
    let cancelled = false;
    setLoading(true);
    fetch("/api/chats")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setChats((data?.chats || []) as Array<{ id: string; title: string; updated_at?: string }>);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, chats.length]);

  const filtered = q.trim()
    ? chats.filter((c) => (c.title || "").toLowerCase().includes(q.trim().toLowerCase()))
    : chats;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="group inline-flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus:outline-none"
            aria-label="Open chat switcher"
          >
            <span className="truncate">{title}</span>
            <span className="text-[10px] opacity-70 transition-opacity group-hover:opacity-100">
              ⌄
            </span>
          </button>
        }
      />
      <PopoverContent align="start" sideOffset={8} className="w-[320px] p-2.5">
        <div className="flex items-center gap-2 px-1 pb-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chats…"
            className="h-8"
            autoFocus
          />
        </div>

        <div className="pb-1">
          <a
            href="/chat"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm border border-border/60 text-[10px]">
              +
            </span>
            New chat
          </a>
        </div>

        <div className="max-h-[320px] overflow-auto pt-1">
          {loading && chats.length === 0 ? (
            <div className="px-2 py-2 text-xs text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-2 py-2 text-xs text-muted-foreground">No chats found.</div>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((c) => (
                <ChatRow
                  key={c.id}
                  id={c.id}
                  title={c.title}
                  active={c.id === currentChatId}
                  onDeleted={(deletedId) =>
                    setChats((prev) => prev.filter((x) => x.id !== deletedId))
                  }
                />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Tool calls are persisted alongside content_md so we re-hydrate them on
 * reload. The model also emits a fenced "tool:<name>" block inline so the
 * markdown copy stays grep-able, but we hide it from rendered output here.
 */
function stripToolBlocks(md: string): string {
  return md.replace(/```tool:[\s\S]*?```/g, "").trim();
}

// Rotating "we're thinking" labels — picks a random phrase from a pool and
// cycles through the rest every ~2.4s. Matches Eden's pre-token chat status.
const STATUS_POOL = [
  "Chasing the thread",
  "Connecting the dots",
  "Threading the needle",
  "Pulling at the thread",
  "Cooking it down",
  "Sketching the angle",
  "Reading between the lines",
  "Lining up the shot",
];

function RotatingStatus() {
  const [phrases] = useState(() => {
    // Random ordering so each chat feels different.
    const arr = [...STATUS_POOL];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setIdx((i) => (i + 1) % phrases.length),
      2400
    );
    return () => clearInterval(t);
  }, [phrases.length]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground italic">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
      <AnimatePresence mode="wait">
        <motion.span
          key={phrases[idx]}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.18 }}
        >
          {phrases[idx]}…
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
