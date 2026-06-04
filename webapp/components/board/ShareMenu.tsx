"use client";

/**
 * Board share dropdown — Eden-style: Private vs Anyone-can-view, plus an
 * affiliate prompt. Visibility is stored on the board's canvas_state for now
 * (no public-render backend yet), so "Anyone can view" toggles the stored flag.
 */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, Lock, Eye } from "lucide-react";

export type Visibility = "private" | "public";

export default function ShareMenu({
  open,
  x,
  y,
  visibility,
  onChange,
  onClose,
}: {
  open: boolean;
  x: number;
  y: number;
  visibility: Visibility;
  onChange: (v: Visibility) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  const left = Math.min(x, window.innerWidth - 320);
  const top = Math.min(y, window.innerHeight - 280);

  const Row = ({
    value,
    icon: Icon,
    title,
    desc,
  }: {
    value: Visibility;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    desc: string;
  }) => (
    <button
      onClick={() => {
        onChange(value);
      }}
      className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-accent"
    >
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <span className="flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
      {visibility === value && (
        <Check className="mt-0.5 h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );

  return createPortal(
    <>
      <div className="fixed inset-0 z-[60]" onPointerDown={onClose} />
      <div
        className="fixed z-[61] w-[300px] overflow-hidden rounded-xl border border-border bg-popover p-1.5 shadow-xl"
        style={{ left, top }}
      >
        <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground/70">
          SHARING
        </div>
        <Row
          value="private"
          icon={Lock}
          title="Private"
          desc="Only workspace members."
        />
        <Row
          value="public"
          icon={Eye}
          title="Anyone can view"
          desc="Public read-only access."
        />
        <div className="my-1 h-px bg-border" />
        <div className="flex items-start gap-2 px-2.5 py-2 text-xs text-muted-foreground">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
          <span>
            Become an affiliate to earn commissions from sharing public boards to
            your audience.{" "}
            <span className="font-medium text-foreground">
              Set up affiliate link →
            </span>
          </span>
        </div>
      </div>
    </>,
    document.body
  );
}
