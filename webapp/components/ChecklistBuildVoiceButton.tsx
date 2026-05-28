"use client";

import { useState } from "react";
import BuildVoiceModal from "./BuildVoiceModal";

/**
 * Inline trigger for the "Build voice" checklist row on the home page.
 * Opens the BuildVoiceModal directly instead of routing through /voice.
 */
export default function ChecklistBuildVoiceButton({
  label = "Build voice",
  done,
}: {
  label?: string;
  done?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors " +
          (done
            ? "border border-[var(--border)] text-[var(--muted-foreground)]"
            : "bg-[var(--primary)] text-[var(--primary-foreground)]")
        }
      >
        {label} →
      </button>
      <BuildVoiceModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
