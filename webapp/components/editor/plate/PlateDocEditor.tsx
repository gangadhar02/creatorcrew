"use client";

/**
 * Plate-based document editor (Notion/Potion-style) — replaces the old custom
 * BlockEditor. Headings, marks, indent-based lists (bulleted / ordered / todo),
 * quotes, code blocks, dividers, with Markdown typing shortcuts (autoformat) and
 * a selection bubble toolbar. Markdown is the source of truth: we deserialize
 * `documents.body_md` in and serialize back out (debounced) via onChange.
 *
 * AI uses OUR Gemini key via /api/ai/command (Vercel AI SDK) — no editor cloud.
 */
import { useCallback, useRef, useState } from "react";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";
import { KEYS } from "platejs";
import { deserializeMd, serializeMd } from "@platejs/markdown";
import { toggleList } from "@platejs/list";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  ListChecks,
  Sparkles,
  Loader2,
  CornerDownLeft,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { editorPlugins } from "./editor-kit";
import FloatingToolbar from "./FloatingToolbar";

export default function PlateDocEditor({
  initialMarkdown,
  onChange,
}: {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
}) {
  const editor = usePlateEditor({
    plugins: editorPlugins,
    value: (ed) => {
      const nodes = initialMarkdown ? deserializeMd(ed, initialMarkdown) : [];
      return nodes.length ? nodes : [{ type: "p", children: [{ text: "" }] }];
    },
  });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Last markdown we persisted, so onChange firing on open / selection / a
  // normalization no-op doesn't overwrite body_md with an identical (or lossy)
  // re-serialization. Only real content edits save.
  const lastSavedRef = useRef(initialMarkdown);
  const handleChange = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        const md = serializeMd(editor);
        if (md === lastSavedRef.current) return;
        lastSavedRef.current = md;
        onChange(md);
      } catch {
        /* ignore serialize errors mid-edit */
      }
    }, 500);
  }, [editor, onChange]);

  return (
    <Plate editor={editor} onChange={handleChange}>
      <Toolbar editor={editor} />
      <PlateContent
        className={cn(
          "min-h-[60vh] py-3 text-[15px] leading-relaxed outline-none",
          "[&_ul]:list-disc [&_ol]:list-decimal"
        )}
        placeholder="Write, type '/' shortcuts like # or - , or press ✨ to ask AI…"
        spellCheck
      />
      <FloatingToolbar />
    </Plate>
  );
}

// ---- Fixed toolbar (marks + blocks + lists + AI) ----
type Editor = NonNullable<ReturnType<typeof usePlateEditor>>;

function Toolbar({ editor }: { editor: Editor }) {
  const [aiOpen, setAiOpen] = useState(false);
  const btn =
    "grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground";
  const sep = <span className="mx-1 h-5 w-px bg-border" />;

  return (
    <div className="sticky top-0 z-10 -mx-1 mb-2 flex flex-wrap items-center gap-0.5 border-b border-border/70 bg-card/80 px-1 py-1 backdrop-blur">
      <button className={btn} title="Bold (⌘B)" onMouseDown={(e) => { e.preventDefault(); editor.tf.toggleMark(KEYS.bold); }}>
        <Bold className="h-4 w-4" />
      </button>
      <button className={btn} title="Italic (⌘I)" onMouseDown={(e) => { e.preventDefault(); editor.tf.toggleMark(KEYS.italic); }}>
        <Italic className="h-4 w-4" />
      </button>
      <button className={btn} title="Underline (⌘U)" onMouseDown={(e) => { e.preventDefault(); editor.tf.toggleMark(KEYS.underline); }}>
        <Underline className="h-4 w-4" />
      </button>
      <button className={btn} title="Strikethrough" onMouseDown={(e) => { e.preventDefault(); editor.tf.toggleMark(KEYS.strikethrough); }}>
        <Strikethrough className="h-4 w-4" />
      </button>
      <button className={btn} title="Inline code (⌘E)" onMouseDown={(e) => { e.preventDefault(); editor.tf.toggleMark(KEYS.code); }}>
        <Code className="h-4 w-4" />
      </button>

      {sep}

      <button className={btn} title="Heading 1" onMouseDown={(e) => { e.preventDefault(); editor.tf.toggleBlock(KEYS.h1); }}>
        <Heading1 className="h-4 w-4" />
      </button>
      <button className={btn} title="Heading 2" onMouseDown={(e) => { e.preventDefault(); editor.tf.toggleBlock(KEYS.h2); }}>
        <Heading2 className="h-4 w-4" />
      </button>
      <button className={btn} title="Heading 3" onMouseDown={(e) => { e.preventDefault(); editor.tf.toggleBlock(KEYS.h3); }}>
        <Heading3 className="h-4 w-4" />
      </button>
      <button className={btn} title="Quote" onMouseDown={(e) => { e.preventDefault(); editor.tf.toggleBlock(KEYS.blockquote); }}>
        <Quote className="h-4 w-4" />
      </button>

      {sep}

      <button className={btn} title="Bulleted list" onMouseDown={(e) => { e.preventDefault(); toggleList(editor, { listStyleType: "disc" }); }}>
        <List className="h-4 w-4" />
      </button>
      <button className={btn} title="Numbered list" onMouseDown={(e) => { e.preventDefault(); toggleList(editor, { listStyleType: "decimal" }); }}>
        <ListOrdered className="h-4 w-4" />
      </button>
      <button className={btn} title="To-do list" onMouseDown={(e) => { e.preventDefault(); toggleList(editor, { listStyleType: "todo" }); }}>
        <ListChecks className="h-4 w-4" />
      </button>

      {sep}

      <button
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm",
          aiOpen
            ? "bg-violet-500/15 text-violet-600 dark:text-violet-400"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
        title="Ask AI"
        onClick={() => setAiOpen((v) => !v)}
      >
        <Sparkles className="h-4 w-4" /> Ask AI
      </button>

      {aiOpen && <AiBar editor={editor} onClose={() => setAiOpen(false)} />}
    </div>
  );
}

// ---- AI bar: prompt -> live stream preview -> accept (Insert) / reject (Discard) ----
function AiBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [prompt, setPrompt] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/ai/command" }),
  });
  const busy = status === "submitted" || status === "streaming";

  // The latest assistant text (streams in token-by-token).
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const streamed = lastAssistant
    ? lastAssistant.parts.map((p) => (p.type === "text" ? p.text : "")).join("")
    : "";
  const done = status === "ready" && !!streamed.trim();

  function submit() {
    const q = prompt.trim();
    if (!q || busy) return;
    let context = "";
    try {
      context = serializeMd(editor);
    } catch {
      /* ignore */
    }
    sendMessage({
      text: context ? `Current document:\n\n${context}\n\n---\n\nTask: ${q}` : q,
    });
    setPrompt("");
  }

  function insertResult() {
    try {
      const nodes = deserializeMd(editor, streamed.trim());
      editor.tf.focus();
      editor.tf.insertNodes(nodes, { nextBlock: true });
    } catch {
      /* ignore */
    }
    onClose();
  }

  return (
    <div className="mt-1 w-full px-1">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-violet-500" />
        <input
          autoFocus
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape") {
              onClose();
            }
          }}
          placeholder="Ask AI to write, rewrite, summarize…"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground/50"
          disabled={busy}
        />
        <button
          onClick={submit}
          disabled={busy || !prompt.trim()}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
          title="Generate"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CornerDownLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {(busy || done) && streamed && (
        <div className="mt-2 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
          <div className="max-h-60 overflow-y-auto whitespace-pre-wrap text-sm text-foreground/90">
            {streamed}
            {busy && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-violet-500 align-middle" />}
          </div>
          {done && (
            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Discard
              </button>
              <button
                onClick={insertResult}
                className="flex items-center gap-1.5 rounded-md bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-600/90"
              >
                <Check className="h-3.5 w-3.5" /> Insert
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
