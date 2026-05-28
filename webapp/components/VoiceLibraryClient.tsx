"use client";

import { useState } from "react";
import BuildVoiceModal from "./BuildVoiceModal";

export default function VoiceLibraryClient() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
      >
        Build voice
      </button>
      <BuildVoiceModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
