"use client";

import { memo, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, X } from "lucide-react";
import { Streamdown } from "streamdown";
import ChatRow from "./ChatRow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  PromptInput,
  PromptInputBody,
  PromptInputHeader,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import type { Chat, ChatMessage } from "@/lib/types-chat";
import MentionAutocomplete, { type MentionHit } from "./MentionAutocomplete";
import VariationsCardList from "./VariationsCardList";
import DocumentCard from "./DocumentCard";
import SocialPostsCard from "./SocialPostsCard";
import CreatorAnalysisCard from "./CreatorAnalysisCard";
import type {
  ShowBoostVariationsArgs,
  DraftDocumentArgs,
  ShowSocialPostsArgs,
  CreatorSnapshotArgs,
} from "@/lib/tools";
import { readNdjsonStream } from "@/lib/chat-stream";
import { filesToAttachments, type ChatAttachment } from "@/lib/chat-files";
import { takePendingChat } from "@/lib/pending-chat";

type Mention = { kind: "post" | "creator" | "list"; id: string; label: string };

export default function ChatThread({
  chat,
  initialMessages,
  embedded = false,
}: {
  chat: Chat;
  initialMessages: ChatMessage[];
  /** Render inside a dialog/popup: fill the parent height instead of the full
   *  viewport, and drop the page-level negative margins + title bar. */
  embedded?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const title = chat.title;
  const [pendingMentions, setPendingMentions] = useState<Mention[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSentRef = useRef(false);

  // First message handed off from the home composer: fire it through the normal
  // streaming path on mount so the answer renders live here. Guarded so it runs
  // once and never on a chat that already has messages.
  useEffect(() => {
    if (autoSentRef.current || initialMessages.length > 0) return;
    const pending = takePendingChat(chat.id);
    if (!pending?.message) return;
    autoSentRef.current = true;
    void sendMessage({
      fullMessage: pending.message,
      mentions: pending.mentions ?? [],
      attachments: pending.attachments,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id]);

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
    const files = pendingFiles;
    if ((!text && files.length === 0) || streaming) return;
    setInput("");
    const mentions = pendingMentions;
    setPendingMentions([]);
    setPendingFiles([]);
    const fileNote = files.length
      ? `\n\n${files.map((f) => `📎 ${f.name}`).join("\n")}`
      : "";
    const fullMessage = `${text}${fileNote}`.trim();
    const attachments = files.length
      ? await filesToAttachments(files)
      : undefined;
    await sendMessage({ fullMessage, mentions, attachments });
  }

  async function sendMessage({
    fullMessage,
    mentions,
    attachments,
  }: {
    fullMessage: string;
    mentions: Mention[];
    attachments?: ChatAttachment[];
  }) {
    if (!fullMessage || streaming) return;
    const userTempId = `tmp-user-${Date.now()}`;
    const assistantTempId = `tmp-assist-${Date.now()}`;
    setStreaming(true);
    setStreamingMessageId(assistantTempId);

    // Optimistic user message
    setMessages((m) => [
      ...m,
      {
        id: userTempId,
        chat_id: chat.id,
        role: "user",
        content_md: fullMessage,
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
          message: fullMessage,
          mentions: mentions.length > 0 ? mentions : undefined,
          attachments,
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

  function onTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Plain Enter sends; Shift+Enter = newline. When the @-mention popup is
    // open, its capture-phase listener picks the highlighted item instead.
    if (e.key === "Enter" && !e.shiftKey && mentionQuery === null) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div
      className={
        embedded
          ? "flex h-full flex-col"
          : "-mx-6 -my-8 flex flex-col lg:-mx-8 lg:-my-10"
      }
      style={embedded ? undefined : { height: "100svh" }}
    >
      {/* Slim title bar — the dialog provides its own header when embedded */}
      {!embedded && (
        <div className="flex h-10 shrink-0 items-center border-b border-border/50 px-6">
          <ChatTitlePicker currentChatId={chat.id} title={title} />
        </div>
      )}

      {/* Conversation — auto-sticks to bottom while streaming */}
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-2xl space-y-6 px-6 py-8">
          {messages.map((m) => (
            <ChatMessageView
              key={m.id}
              m={m}
              streaming={streamingMessageId === m.id}
            />
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Composer */}
      <div className="shrink-0 bg-gradient-to-t from-background via-background/95 to-transparent px-6 pb-5 pt-4">
        <div className="relative mx-auto w-full max-w-2xl">
          <PromptInput
            onSubmit={(_message, e) => {
              e.preventDefault();
              send();
            }}
            className="rounded-2xl shadow-[0_14px_60px_-34px_rgba(0,0,0,0.65)]"
          >
            {(pendingMentions.length > 0 || pendingFiles.length > 0) && (
              <PromptInputHeader>
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
                {pendingFiles.map((f, i) => (
                  <Badge
                    key={`file-${i}-${f.name}`}
                    variant="secondary"
                    className="gap-1 pl-2 pr-1 text-[10px] font-normal"
                  >
                    📎 {f.name.length > 22 ? `${f.name.slice(0, 20)}…` : f.name}
                    <button
                      type="button"
                      onClick={() =>
                        setPendingFiles((p) => p.filter((_, idx) => idx !== i))
                      }
                      className="rounded-sm p-0.5 text-muted-foreground hover:bg-background/40 hover:text-foreground"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </PromptInputHeader>
            )}

            <PromptInputBody>
              <PromptInputTextarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onTextareaKeyDown}
                placeholder="Ask anything…  (@ to add context)"
                disabled={streaming}
                // Tell password managers / form fillers to ignore this field;
                // some inject input events into controlled textareas and cause a
                // setState feedback loop ("Maximum update depth").
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                data-form-type="other"
              />
            </PromptInputBody>

            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputButton
                  title="Attach images or PDFs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Plus className="h-4 w-4" />
                </PromptInputButton>
              </PromptInputTools>
              <PromptInputSubmit
                status={streaming ? "streaming" : "ready"}
                disabled={streaming || (!input.trim() && pendingFiles.length === 0)}
              />
            </PromptInputFooter>
          </PromptInput>

          {/* Hidden file picker driven by the + button */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files || []).filter(
                (f) => f.size <= 15 * 1024 * 1024
              );
              setPendingFiles((prev) => [...prev, ...picked].slice(0, 6));
              e.target.value = "";
            }}
          />

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
  );
}

// Memoized so a completed message doesn't re-render on every streaming token of
// a later message. During streaming, setMessages maps over the list and returns
// the SAME object reference for untouched messages, so memo's shallow prop check
// (`m` identity + `streaming` flag) skips them — only the live message re-renders.
const ChatMessageView = memo(function ChatMessageView({
  m,
  streaming,
}: {
  m: ChatMessage;
  streaming?: boolean;
}) {
  if (m.role === "system") {
    return (
      <div className="mx-auto max-w-[90%] rounded-xl border border-rose-300 bg-rose-50/50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300">
        {m.content_md}
      </div>
    );
  }

  const isUser = m.role === "user";
  const toolCalls = (m.tool_calls as { name: string; args: unknown }[] | null) || [];

  return (
    <Message from={m.role}>
      <MessageContent>
        {/* Reasoning / thoughts */}
        {!isUser && m.thoughts_md && (
          <Reasoning
            className="mb-3 w-full"
            isStreaming={!!streaming && !m.content_md}
          >
            <ReasoningTrigger />
            <ReasoningContent>{m.thoughts_md}</ReasoningContent>
          </Reasoning>
        )}

        {/* Tool-call renderings (generative-UI cards) */}
        {!isUser &&
          toolCalls.map((tc, i) => {
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
            if (tc.name === "draftDocument") {
              const args = tc.args as DraftDocumentArgs;
              if (args?.title && args?.content) {
                return (
                  <div key={i} className="my-2">
                    <DocumentCard
                      kind={args.kind ?? "other"}
                      title={args.title}
                      content={args.content}
                    />
                  </div>
                );
              }
            }
            if (tc.name === "showSocialPosts") {
              const args = tc.args as ShowSocialPostsArgs;
              if (Array.isArray(args?.postIds) && args.postIds.length > 0) {
                return (
                  <div key={i} className="my-2">
                    <SocialPostsCard
                      postIds={args.postIds}
                      handle={args.handle}
                      note={args.note}
                    />
                  </div>
                );
              }
            }
            if (tc.name === "creatorSnapshot") {
              const args = tc.args as CreatorSnapshotArgs;
              if (args?.handle && args?.platform) {
                return (
                  <div key={i} className="my-2">
                    <CreatorAnalysisCard args={args} />
                  </div>
                );
              }
            }
            return null;
          })}

        {/* Body */}
        {isUser ? (
          <span className="whitespace-pre-wrap">{m.content_md}</span>
        ) : m.content_md ? (
          <Streamdown>{stripToolBlocks(m.content_md)}</Streamdown>
        ) : streaming ? (
          <RotatingStatus />
        ) : null}
      </MessageContent>
    </Message>
  );
});

ChatMessageView.displayName = "ChatMessageView";

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
// cycles through the rest every ~2.4s while waiting for the first token.
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
