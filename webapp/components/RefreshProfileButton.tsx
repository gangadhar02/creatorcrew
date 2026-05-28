"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RefreshProfileButton({ handle }: { handle: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/profiles/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <button
        onClick={run}
        disabled={running}
        className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] disabled:opacity-50"
      >
        {running ? "Refreshing…" : "Refresh"}
      </button>
      {error && (
        <span className="text-[10px] text-rose-500 max-w-[180px] truncate" title={error}>
          {error}
        </span>
      )}
    </>
  );
}
