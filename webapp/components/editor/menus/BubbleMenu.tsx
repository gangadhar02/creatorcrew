"use client";

import { createPortal } from "react-dom";
import { Bold, Italic, Code, Link2 } from "lucide-react";

export type WrapKind = "bold" | "italic" | "code" | "link";

export default function BubbleMenu({
  open,
  x,
  y,
  onWrap,
}: {
  open: boolean;
  x: number;
  y: number;
  onWrap: (kind: WrapKind) => void;
}) {
  if (!open || typeof document === "undefined") return null;

  const items: { kind: WrapKind; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
    { kind: "bold", icon: Bold, label: "Bold" },
    { kind: "italic", icon: Italic, label: "Italic" },
    { kind: "code", icon: Code, label: "Code" },
    { kind: "link", icon: Link2, label: "Link" },
  ];

  return createPortal(
    <div
      className="fixed z-[101] flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg"
      style={{ left: x, top: y }}
      // Keep the textarea selection alive when clicking a button.
      onMouseDown={(e) => e.preventDefault()}
    >
      {items.map((it) => (
        <button
          key={it.kind}
          title={it.label}
          onClick={() => onWrap(it.kind)}
          className="rounded-md p-1.5 text-popover-foreground hover:bg-accent"
        >
          <it.icon className="h-4 w-4" />
        </button>
      ))}
    </div>,
    document.body
  );
}
