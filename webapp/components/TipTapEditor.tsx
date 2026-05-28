"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { Markdown } from "tiptap-markdown";
import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

type Props = {
  /** Initial markdown content */
  initial: string;
  /** Called with markdown when the user pauses typing (debounced) or blurs */
  onSave: (markdown: string) => Promise<void>;
  placeholder?: string;
  className?: string;
};

export default function TipTapEditor({
  initial,
  onSave,
  placeholder = "Write…",
  className,
}: Props) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const errorMsg = useRef<string>("");
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: { HTMLAttributes: { class: "rounded bg-zinc-100 dark:bg-zinc-800 p-2 text-sm" } } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "underline" } }),
      Placeholder.configure({ placeholder }),
      Typography,
      Markdown.configure({ html: false, tightLists: true }),
    ],
    content: initial || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-zinc max-w-none focus:outline-none min-h-[8rem] prose-headings:font-semibold prose-h2:text-lg prose-h2:mt-4 prose-h3:text-base prose-p:my-2 prose-li:my-0.5",
      },
    },
    onUpdate: ({ editor }) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        const md = (
          editor.storage as unknown as { markdown: { getMarkdown(): string } }
        ).markdown.getMarkdown();
        setSaveState("saving");
        try {
          await onSave(md);
          setSaveState("saved");
          setTimeout(() => setSaveState("idle"), 1500);
        } catch (e) {
          errorMsg.current = String(e);
          setSaveState("error");
        }
      }, 800);
    },
    onBlur: async ({ editor }) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      const md = (
        editor.storage as unknown as { markdown: { getMarkdown(): string } }
      ).markdown.getMarkdown();
      if (md === initial) return;
      setSaveState("saving");
      try {
        await onSave(md);
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1500);
      } catch (e) {
        errorMsg.current = String(e);
        setSaveState("error");
      }
    },
    immediatelyRender: false, // Next.js SSR compatibility
  });

  useEffect(() => () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
  }, []);

  if (!editor) return null;

  return (
    <div className={clsx("rounded-lg border border-[var(--border)] bg-[var(--card)]", className)}>
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-1.5">
        <Toolbar editor={editor} />
        <SaveIndicator state={saveState} error={errorMsg.current} />
      </div>
      <div className="px-4 py-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  const btn = (active: boolean) =>
    clsx(
      "rounded px-2 py-1 text-xs",
      active
        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
        : "text-[var(--muted-foreground)] hover:bg-[var(--border)]/50 hover:text-[var(--foreground)]"
    );
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive("bold"))}
      >
        B
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive("italic"))}
      >
        I
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btn(editor.isActive("strike"))}
      >
        S
      </button>
      <span className="mx-1 h-4 w-px bg-[var(--border)]" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btn(editor.isActive("heading", { level: 2 }))}
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btn(editor.isActive("heading", { level: 3 }))}
      >
        H3
      </button>
      <span className="mx-1 h-4 w-px bg-[var(--border)]" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive("bulletList"))}
      >
        •
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btn(editor.isActive("orderedList"))}
      >
        1.
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btn(editor.isActive("blockquote"))}
      >
        ❝
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={btn(editor.isActive("code"))}
      >
        {"</>"}
      </button>
    </div>
  );
}

function SaveIndicator({
  state,
  error,
}: {
  state: "idle" | "saving" | "saved" | "error";
  error: string;
}) {
  if (state === "idle") return null;
  if (state === "saving")
    return <span className="text-xs text-[var(--muted-foreground)]">Saving…</span>;
  if (state === "saved")
    return (
      <span className="text-xs text-emerald-600 dark:text-emerald-400">
        ✓ Saved
      </span>
    );
  return (
    <span className="text-xs text-rose-600 dark:text-rose-400" title={error}>
      ✗ Save failed
    </span>
  );
}
