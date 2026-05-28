"use client";

import { useEffect, useState } from "react";
import type { Voice } from "@/lib/types";

/**
 * Compact voice selector used inline (e.g., inside the chat input area).
 * Reads workspace voices + archetypes. Displays just the name.
 */
export default function VoicePicker({
  value,
  onChange,
  className,
  placeholder = "Default voice",
}: {
  value: string | null;
  onChange: (voiceId: string | null) => void;
  className?: string;
  placeholder?: string;
}) {
  const [voices, setVoices] = useState<Voice[]>([]);

  useEffect(() => {
    fetch("/api/voices")
      .then((r) => r.json())
      .then((d) => {
        const ws = (d.workspace || []) as Voice[];
        setVoices(ws);
      })
      .catch(() => {});
  }, []);

  return (
    <div className={"inline-flex items-center " + (className || "")}>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs focus:outline-none"
      >
        <option value="">{placeholder}</option>
        {voices.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
            {v.is_default ? " (default)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
