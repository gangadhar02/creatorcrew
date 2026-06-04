"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Heading1,
  Heading2,
  Heading3,
  Type,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Sigma,
  Minus,
  Table as TableIcon,
  Image as ImageIcon,
} from "lucide-react";
import { type BlockType } from "../model/types";

export type SlashItem = {
  type: BlockType;
  label: string;
  keywords: string;
  group: "HEADINGS" | "BASIC BLOCKS";
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
};

const ITEMS: SlashItem[] = [
  { type: "h1", label: "Heading 1", keywords: "h1 title big heading", group: "HEADINGS", hint: "#", icon: Heading1 },
  { type: "h2", label: "Heading 2", keywords: "h2 subtitle heading", group: "HEADINGS", hint: "##", icon: Heading2 },
  { type: "h3", label: "Heading 3", keywords: "h3 heading", group: "HEADINGS", hint: "###", icon: Heading3 },
  { type: "paragraph", label: "Paragraph", keywords: "text paragraph body", group: "BASIC BLOCKS", icon: Type },
  { type: "bullet", label: "Bulleted list", keywords: "bullet list unordered ul", group: "BASIC BLOCKS", hint: "-", icon: List },
  { type: "numbered", label: "Numbered list", keywords: "numbered ordered ol list", group: "BASIC BLOCKS", hint: "1.", icon: ListOrdered },
  { type: "checklist", label: "To-do list", keywords: "todo checklist task checkbox", group: "BASIC BLOCKS", hint: "[]", icon: ListChecks },
  { type: "quote", label: "Quote", keywords: "quote blockquote", group: "BASIC BLOCKS", hint: ">", icon: Quote },
  { type: "code", label: "Code Block", keywords: "code monospace pre", group: "BASIC BLOCKS", hint: "```", icon: Code },
  { type: "math", label: "Math Block", keywords: "math equation latex katex tex formula", group: "BASIC BLOCKS", hint: "$$", icon: Sigma },
  { type: "divider", label: "Divider", keywords: "divider hr rule line", group: "BASIC BLOCKS", hint: "---", icon: Minus },
  { type: "table", label: "Table", keywords: "table grid rows columns", group: "BASIC BLOCKS", icon: TableIcon },
  { type: "image", label: "Image", keywords: "image picture photo media", group: "BASIC BLOCKS", icon: ImageIcon },
];

export default function SlashMenu({
  open,
  x,
  y,
  query,
  onPick,
  onClose,
}: {
  open: boolean;
  x: number;
  y: number;
  query: string;
  onPick: (type: BlockType) => void;
  onClose: () => void;
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ITEMS;
    return ITEMS.filter(
      (it) => it.label.toLowerCase().includes(q) || it.keywords.includes(q)
    );
  }, [query]);

  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [query, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[active]) onPick(filtered[active].type);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, filtered, active, onPick, onClose]);

  if (!open || typeof document === "undefined" || filtered.length === 0) return null;

  const top = Math.min(y, window.innerHeight - 380);
  const left = Math.min(x, window.innerWidth - 280);

  // Render grouped, but track the flat index for keyboard highlight.
  let flatIndex = -1;
  const groups: SlashItem["group"][] = ["HEADINGS", "BASIC BLOCKS"];

  return createPortal(
    <div
      className="subtle-scroll fixed z-[100] max-h-[360px] w-[268px] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-xl"
      style={{ top, left }}
      onPointerDown={(e) => e.preventDefault()}
    >
      {groups.map((g) => {
        const items = filtered.filter((it) => it.group === g);
        if (items.length === 0) return null;
        return (
          <div key={g} className="mb-1">
            <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground/70">
              {g}
            </div>
            {items.map((it) => {
              flatIndex += 1;
              const i = flatIndex;
              return (
                <button
                  key={it.type + it.label}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => onPick(it.type)}
                  className={
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm " +
                    (i === active ? "bg-accent" : "")
                  }
                >
                  <it.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">{it.label}</span>
                  {it.hint && (
                    <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {it.hint}
                    </kbd>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>,
    document.body
  );
}
