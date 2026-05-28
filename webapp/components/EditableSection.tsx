"use client";

import TipTapEditor from "./TipTapEditor";

type Props = {
  ideaId: string;
  field: "outline_md" | "ig_breakdown_md" | "x_breakdown_md" | "youtube_breakdown_md" | "body_md";
  initial: string;
  label: string;
  placeholder?: string;
};

/**
 * One field of a content idea, edited inline via TipTap.
 * Saves to /api/ideas/[id] via PATCH on blur/debounce.
 */
export default function EditableSection({
  ideaId,
  field,
  initial,
  label,
  placeholder,
}: Props) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
        {label}
      </h2>
      <TipTapEditor
        initial={initial}
        placeholder={placeholder}
        onSave={async (md) => {
          const res = await fetch(`/api/ideas/${ideaId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: md }),
          });
          if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e.error || `HTTP ${res.status}`);
          }
        }}
      />
    </section>
  );
}
