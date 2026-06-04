"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BoostAction } from "@/lib/boost-presets";
import { BOOST_PRESETS } from "@/lib/boost-presets";

export default function BoostMenu({
  postId,
  onClose,
}: {
  postId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [running, setRunning] = useState<BoostAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function run(action: BoostAction) {
    setRunning(action);
    setError(null);
    try {
      const res = await fetch("/api/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, action }),
      });
      const data = await res.json();
      if (res.ok && data.chat_id) {
        router.push(`/chats/${data.chat_id}`);
      } else {
        setError(data.error || `HTTP ${res.status}`);
        setRunning(null);
      }
    } catch (e) {
      setError(String(e));
      setRunning(null);
    }
  }

  return (
    <div
      ref={ref}
      className="absolute right-3 top-10 z-30 w-72 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden"
    >
      <div className="border-b border-[var(--border)] px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
        Boost
      </div>
      <div className="py-1">
        {(
          Object.entries(BOOST_PRESETS) as [
            BoostAction,
            { label: string; description: string },
          ][]
        ).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => run(key)}
            disabled={running !== null}
            className="block w-full text-left px-3 py-1.5 hover:bg-[var(--border)]/30 disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium">{preset.label}</div>
              {running === key && (
                <span className="text-[10px] text-[var(--muted-foreground)]">…</span>
              )}
            </div>
            <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5 line-clamp-1">
              {preset.description}
            </div>
          </button>
        ))}
      </div>
      {running && (
        <div className="border-t border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-[10px] text-[var(--muted-foreground)]">
          Creating chat… (10-30s for the first response)
        </div>
      )}
      {error && (
        <div className="border-t border-[var(--border)] bg-destructive/10 px-3 py-1.5 text-[10px] text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
