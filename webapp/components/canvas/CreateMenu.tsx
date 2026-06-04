"use client";

/**
 * Eden-style "create" menu: a small floating menu opened by right-click or
 * double-click on empty canvas. Rendered in a portal at screen coordinates with
 * a click-away backdrop. Items mirror Eden: Insert link, Create document,
 * Create card, Add section.
 */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link2, FileText, StickyNote, FolderPlus } from "lucide-react";

export type CreateAction = "link" | "document" | "card" | "section";

const ITEMS: {
  action: CreateAction;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { action: "link", label: "Paste a link", hint: "⌘L", icon: Link2 },
  { action: "document", label: "Create a document", hint: "D", icon: FileText },
  { action: "card", label: "Create a card", hint: "C", icon: StickyNote },
  { action: "section", label: "Add section", hint: "S", icon: FolderPlus },
];

export default function CreateMenu({
  open,
  x,
  y,
  onClose,
  onPick,
}: {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onPick: (action: CreateAction) => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  // Keep the menu inside the viewport.
  const MENU_W = 220;
  const MENU_H = 188;
  const left = Math.min(x, window.innerWidth - MENU_W - 8);
  const top = Math.min(y, window.innerHeight - MENU_H - 8);

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[60]"
        onPointerDown={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className="fixed z-[61] w-[220px] overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg"
        style={{ left, top }}
        role="menu"
      >
        {ITEMS.map((it) => (
          <button
            key={it.action}
            role="menuitem"
            onClick={() => {
              onPick(it.action);
              onClose();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-accent"
          >
            <it.icon className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">{it.label}</span>
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {it.hint}
            </kbd>
          </button>
        ))}
      </div>
    </>,
    document.body
  );
}
