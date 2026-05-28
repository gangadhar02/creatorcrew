"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AnalyzeProfileForm() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [maxPosts, setMaxPosts] = useState<number>(90);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!handle.trim()) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/profiles/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: handle.trim(),
          maxPosts: Math.max(1, Math.min(500, maxPosts || 90)),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      router.push(`/profiles/${data.handle}`);
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@username or username"
          disabled={running}
          className="flex-1 min-w-[240px] rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 disabled:opacity-50"
        />
        <div className="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 text-sm">
          <label className="text-xs text-[var(--muted-foreground)]" htmlFor="maxPosts">
            cap
          </label>
          <input
            id="maxPosts"
            type="number"
            min={1}
            max={500}
            step={1}
            value={maxPosts}
            onChange={(e) => {
              const raw = e.target.value;
              const n = parseInt(raw || "90", 10);
              setMaxPosts(Number.isFinite(n) ? n : 90);
            }}
            disabled={running}
            className="w-14 bg-transparent py-1.5 text-sm tabular-nums focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={running || !handle.trim()}
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
        >
          {running ? "Analyzing…" : "Analyze"}
        </button>
      </form>
      {running ? (
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          Fetching profile + up to {maxPosts} recent posts from Instagram,
          computing typical stats and outlier scores. ~
          {Math.max(15, Math.round(maxPosts * 0.3))}-{Math.round(maxPosts * 0.9)}s.
        </p>
      ) : (
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          Range: 1-500 posts. Default 90. Higher = more data but slightly more
          IG API load.
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
