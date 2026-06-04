"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Columns3, Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import ChatRow from "./ChatRow";
import MentionAutocomplete, { type MentionHit } from "./MentionAutocomplete";
import { BOOST_STARTERS, type StarterKey } from "@/lib/boost-starters";
import type { Chat } from "@/lib/types-chat";
import { filesToAttachments } from "@/lib/chat-files";
import { setPendingChat } from "@/lib/pending-chat";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";

type Mention = { kind: "post" | "creator" | "list"; id: string; label: string };

export default function NewChatHome({ recent }: { recent: Chat[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [recentChats, setRecentChats] = useState(recent);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingMentions, setPendingMentions] = useState<Mention[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect @-mention typing (mirrors ChatThread).
  useEffect(() => {
    if (!inputRef.current) return;
    const ta = inputRef.current;
    const before = message.slice(0, ta.selectionStart);
    const match = before.match(/@(\w*)$/);
    setMentionQuery(match ? match[1] : null);
  }, [message]);

  function insertMention(hit: MentionHit) {
    if (!inputRef.current) return;
    const ta = inputRef.current;
    const cursor = ta.selectionStart;
    const before = message.slice(0, cursor);
    const after = message.slice(cursor);
    const newBefore = before.replace(/@(\w*)$/, `@${hit.label} `);
    setMessage(newBefore + after);
    setPendingMentions((m) => [
      ...m,
      { kind: hit.kind, id: hit.id, label: hit.label },
    ]);
    setMentionQuery(null);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const pos = newBefore.length;
        inputRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  }

  async function send(prefill?: string) {
    const text = (prefill ?? message).trim();
    // Boost starters don't carry files or mentions; only the typed composer does.
    const files = prefill ? [] : pendingFiles;
    const mentions = prefill ? [] : pendingMentions;
    if ((!text && files.length === 0) || sending) return;
    setSending(true);
    const fileNote = files.length
      ? `\n\n${files.map((f) => `📎 ${f.name}`).join("\n")}`
      : "";
    const fullMessage = `${text}${fileNote}`.trim();
    setPendingFiles([]);
    setPendingMentions([]);
    const attachments = files.length
      ? await filesToAttachments(files)
      : undefined;

    // Create an empty chat, hand the prompt off in-memory, then navigate. The
    // chat view fires the message through its own streaming send() on mount so
    // the answer renders live in place (instead of streaming into this page,
    // which is about to unmount).
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: text || fullMessage, context_kind: "freeform" }),
      });
      const data = (await res.json()) as { chat?: { id: string }; error?: string };
      if (!res.ok || !data.chat?.id) {
        throw new Error(data.error || "couldn't create chat");
      }
      setPendingChat(data.chat.id, {
        message: fullMessage,
        attachments,
        mentions: mentions.length > 0 ? mentions : undefined,
      });
      router.push(`/chats/${data.chat.id}`);
    } catch (e) {
      toast.error("Couldn't start chat", { description: String(e) });
      setSending(false);
    }
  }

  const starters = Object.entries(BOOST_STARTERS) as [
    StarterKey,
    {
      label: string;
      icon: string;
      description: string;
      prompt: string;
    },
  ][];

  return (
    <div className="-mx-6 -my-8 flex flex-col lg:-mx-8 lg:-my-10" style={{ minHeight: "100svh" }}>
      <section className="flex flex-1 flex-col items-center justify-center pb-12 pt-16">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-xl"
        >
          <h1 className="mb-6 flex items-center justify-center gap-2 text-center text-2xl font-semibold tracking-[-0.03em]">
            <Sparkles className="h-5 w-5 text-emerald-700" />
            What deserves your attention today?
          </h1>

          <div className="relative">
          <PromptInput
            onSubmit={(_message, e) => {
              e.preventDefault();
              send();
            }}
            className="rounded-2xl shadow-[0_12px_50px_-32px_rgba(0,0,0,0.5)]"
          >
            {(pendingFiles.length > 0 || pendingMentions.length > 0) && (
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
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  // When the @-mention popup is open, let it handle Enter.
                  if (e.key === "Enter" && !e.shiftKey && mentionQuery === null) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask anything…  (@ to add context, + for files)"
                disabled={sending}
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
                status={sending ? "streaming" : "ready"}
                disabled={sending || (!message.trim() && pendingFiles.length === 0)}
              />
            </PromptInputFooter>
          </PromptInput>

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
        </motion.div>

        <div className="mt-7 grid w-full max-w-xl items-start gap-10 sm:grid-cols-2">
          <CompactList title="Recent">
            {recentChats.slice(0, 6).map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.025, duration: 0.2 }}
                className="group flex min-w-0 items-center gap-1"
              >
                <ChatRow
                  id={c.id}
                  title={c.title}
                  showCheck={false}
                  className="min-w-0 flex-1"
                  onDeleted={(deletedId) =>
                    setRecentChats((prev) => prev.filter((x) => x.id !== deletedId))
                  }
                  onRenamed={(renamedId, t) =>
                    setRecentChats((prev) =>
                      prev.map((x) =>
                        x.id === renamedId ? { ...x, title: t } : x
                      )
                    )
                  }
                />
                <Link
                  href={`/workspace?panes=chat%3A${c.id}&active=0`}
                  title="Open in workspace pane"
                  className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                >
                  <Columns3 className="h-3 w-3" />
                </Link>
              </motion.div>
            ))}
            {recentChats.length === 0 && (
              <p className="px-1.5 py-1 text-xs text-muted-foreground">
                Your chats will appear here.
              </p>
            )}
          </CompactList>

          <CompactList title="Boosts">
            {starters.slice(0, 6).map(([key, s], i) => (
              <motion.button
                key={key}
                onClick={() => send(s.prompt)}
                disabled={sending}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.025, duration: 0.2 }}
                className="group flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:opacity-50"
              >
                <span className="w-4 shrink-0 text-center text-[12px]">{s.icon}</span>
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                <ArrowRight className="h-3 w-3 shrink-0 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
              </motion.button>
            ))}
          </CompactList>
        </div>
      </section>
    </div>
  );
}

function CompactList({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <h2 className="mb-2 px-1.5 text-[11px] font-medium text-muted-foreground">
        {title}
      </h2>
      <div className={cn("space-y-0.5")}>{children}</div>
    </div>
  );
}
