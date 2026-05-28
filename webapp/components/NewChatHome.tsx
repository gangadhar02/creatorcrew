"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Columns3, Plus, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ChatRow from "./ChatRow";
import { BOOST_STARTERS, type StarterKey } from "@/lib/boost-starters";
import type { Chat } from "@/lib/types-chat";
import { streamChat } from "@/lib/chat-stream";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export default function NewChatHome({ recent }: { recent: Chat[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [recentChats, setRecentChats] = useState(recent);

  async function send(prefill?: string) {
    const text = prefill ?? message;
    if (!text.trim() || sending) return;
    setSending(true);
    let navigated = false;
    const result = await streamChat(
      {
        message: text,
        context_kind: "freeform",
      },
      {
        onStart: (chatId) => {
          navigated = true;
          router.push(`/chats/${chatId}`);
        },
        onError: (msg) => toast.error("Couldn't start chat", { description: msg }),
      }
    );
    if (!navigated && result?.chat_id) {
      router.push(`/chats/${result.chat_id}`);
    }
    setSending(false);
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

          <div className="rounded-2xl border border-border/80 bg-card/90 p-2 shadow-[0_12px_50px_-32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
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
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask anything…"
                rows={1}
                disabled={sending}
                className="min-h-9 resize-none border-0 bg-transparent px-0 py-2 text-sm shadow-none focus-visible:ring-0"
              />
              <Button
                onClick={() => send()}
                disabled={sending || !message.trim()}
                size="icon-sm"
                className="mb-0.5 rounded-full"
                title="Send"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

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
