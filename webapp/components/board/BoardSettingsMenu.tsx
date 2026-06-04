"use client";

/**
 * Board settings dropdown (gear icon) — Eden-style: sort options + filter by
 * item type, plus version history / save-as-template actions.
 */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, History, Bookmark } from "lucide-react";

export type SortMode = "custom" | "created" | "modified" | "name" | "type";
export type ItemKindFilter = "document" | "card" | "post" | "file";

const SORTS: { key: SortMode; label: string }[] = [
  { key: "custom", label: "Custom sort" },
  { key: "created", label: "Date Created" },
  { key: "modified", label: "Last modified" },
  { key: "name", label: "Name" },
  { key: "type", label: "Item Type" },
];

const KINDS: { key: ItemKindFilter; label: string }[] = [
  { key: "document", label: "Documents" },
  { key: "card", label: "Notes" },
  { key: "post", label: "Social posts" },
  { key: "file", label: "Media" },
];

export default function BoardSettingsMenu({
  open,
  x,
  y,
  sort,
  onSort,
  enabled,
  onToggleKind,
  onDisplayAll,
  onVersionHistory,
  onSaveTemplate,
  onClose,
}: {
  open: boolean;
  x: number;
  y: number;
  sort: SortMode;
  onSort: (s: SortMode) => void;
  enabled: Set<ItemKindFilter>;
  onToggleKind: (k: ItemKindFilter) => void;
  onDisplayAll: () => void;
  onVersionHistory?: () => void;
  onSaveTemplate?: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  const allOn = enabled.size === KINDS.length;
  const left = Math.min(x, window.innerWidth - 268);
  const top = Math.min(y, window.innerHeight - 460);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[60]" onPointerDown={onClose} />
      <div
        className="fixed z-[61] w-[256px] overflow-hidden rounded-xl border border-border bg-popover p-1.5 shadow-xl"
        style={{ left, top }}
      >
        <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground/70">
          SORT BY
        </div>
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => onSort(s.key)}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent"
          >
            <span className={sort === s.key ? "font-medium" : ""}>{s.label}</span>
            {sort === s.key && <Check className="h-4 w-4 text-muted-foreground" />}
          </button>
        ))}

        <div className="my-1 h-px bg-border" />

        <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground/70">
          FILTER BY TYPE
        </div>
        <button
          onClick={onDisplayAll}
          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent"
        >
          <span>Display all</span>
          {allOn && <Check className="h-4 w-4 text-muted-foreground" />}
        </button>
        {KINDS.map((k) => {
          const on = enabled.has(k.key);
          return (
            <button
              key={k.key}
              onClick={() => onToggleKind(k.key)}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent"
            >
              <span>{k.label}</span>
              <span
                className={
                  "grid h-4 w-4 place-items-center rounded border " +
                  (on
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-border")
                }
              >
                {on && <Check className="h-3 w-3" />}
              </span>
            </button>
          );
        })}

        <div className="my-1 h-px bg-border" />

        <button
          onClick={() => {
            onVersionHistory?.();
            onClose();
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent"
        >
          <History className="h-4 w-4 text-muted-foreground" />
          Version history
        </button>
        <button
          onClick={() => {
            onSaveTemplate?.();
            onClose();
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent"
        >
          <Bookmark className="h-4 w-4 text-muted-foreground" />
          Save as template
        </button>
      </div>
    </>,
    document.body
  );
}
