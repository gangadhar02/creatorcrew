"use client";

/**
 * Eden-style section tabs: "All" + one tab per section. Sections are stored as
 * `board_items.tag`; empty sections persist in `boards.canvas_state.sections`
 * so a freshly-added (item-less) section still shows. Clicking a tab filters;
 * the active tab is also where newly-created items land.
 */
import { Plus } from "lucide-react";

export default function SectionTabs({
  sections,
  counts,
  total,
  activeTag,
  onSelect,
  onAddSection,
}: {
  sections: string[];
  counts: Record<string, number>;
  total: number;
  activeTag: string | null;
  onSelect: (tag: string | null) => void;
  onAddSection: () => void;
}) {
  const tabBase =
    "rounded-full px-3 py-1 text-xs transition-colors whitespace-nowrap";
  const active = "bg-accent text-foreground font-medium";
  const idle =
    "border border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={() => onSelect(null)}
        className={`${tabBase} ${activeTag === null ? active : idle}`}
      >
        All ({total})
      </button>
      {sections.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className={`${tabBase} ${activeTag === s ? active : idle}`}
        >
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle" />
          {s} ({counts[s] ?? 0})
        </button>
      ))}
      <button
        onClick={onAddSection}
        title="Add section"
        className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3 w-3" />
        Section
      </button>
    </div>
  );
}
