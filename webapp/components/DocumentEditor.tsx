"use client";

import { useState } from "react";
import type { Document } from "@/lib/types-boards";
import TipTapEditor from "./TipTapEditor";

export default function DocumentEditor({ initial }: { initial: Document }) {
  const [title, setTitle] = useState(initial.title);
  const [titleSaving, setTitleSaving] = useState(false);

  async function saveTitle() {
    if (title === initial.title) return;
    setTitleSaving(true);
    try {
      await fetch(`/api/documents/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    } finally {
      setTitleSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={saveTitle}
        placeholder="Untitled"
        className="w-full bg-transparent text-3xl font-semibold focus:outline-none"
      />
      <TipTapEditor
        initial={initial.body_md}
        placeholder="Start writing…"
        onSave={async (md) => {
          const res = await fetch(`/api/documents/${initial.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body_md: md }),
          });
          if (!res.ok) throw new Error((await res.json()).error || "save failed");
        }}
      />
      {titleSaving && (
        <div className="text-xs text-[var(--muted-foreground)]">Saving title…</div>
      )}
    </div>
  );
}
