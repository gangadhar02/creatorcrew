"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

type JobStatus = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  handle: string;
  posts_synced?: number;
  error_message?: string | null;
};

/**
 * Refresh a saved profile by re-running the analyzer. Behavior matches
 * AnalyzeProfileForm:
 *   - Vercel (queue mode): POST returns { job_id }, then we poll
 *     /api/profiles/analyze/[id] every 3s until status='completed'.
 *   - Local dev (inline mode): POST returns the result directly, we
 *     call router.refresh() immediately.
 */
export default function RefreshProfileButton({ handle }: { handle: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState<string>("");
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollerRef.current) clearInterval(pollerRef.current);
    };
  }, []);

  async function readJsonSafe(res: Response): Promise<{ error?: string } & Record<string, unknown>> {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      // Surface the HTML/text body so we don't lose the actual error.
      throw new Error(
        `Server returned non-JSON (HTTP ${res.status}). ${text.slice(0, 200)}`
      );
    }
  }

  async function poll(jobId: string) {
    setStatusText("Queued — waiting for GitHub Actions runner…");
    pollerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/profiles/analyze/${jobId}`);
        if (!res.ok) return;
        const data = (await readJsonSafe(res)) as unknown as JobStatus;
        if (!data.status) return;
        if (data.status === "running") {
          setStatusText(
            data.posts_synced
              ? `Running — ${data.posts_synced} posts so far`
              : "Running — fetching posts from Instagram"
          );
        }
        if (data.status === "completed") {
          if (pollerRef.current) clearInterval(pollerRef.current);
          setStatusText("");
          setBusy(false);
          toast.success(
            `Refreshed @${data.handle}${data.posts_synced ? ` (${data.posts_synced} posts)` : ""}`
          );
          router.refresh();
        }
        if (data.status === "failed") {
          if (pollerRef.current) clearInterval(pollerRef.current);
          setStatusText("");
          setBusy(false);
          toast.error(data.error_message || "Refresh failed");
        }
      } catch (err) {
        if (pollerRef.current) clearInterval(pollerRef.current);
        setStatusText("");
        setBusy(false);
        toast.error(err instanceof Error ? err.message : String(err));
      }
    }, 3000);
  }

  async function run() {
    if (busy) return;
    setBusy(true);
    setStatusText("Submitting…");
    try {
      const res = await fetch("/api/profiles/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // force: Refresh is an explicit user action — bypass the freshness guard.
        body: JSON.stringify({ handle, force: true }),
      });
      const data = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error((data.error as string) || `HTTP ${res.status}`);
      }

      // Inline mode — already done.
      if (data.mode === "inline") {
        setBusy(false);
        setStatusText("");
        toast.success(`Refreshed @${handle}`);
        router.refresh();
        return;
      }

      // Queue mode — start polling.
      const jobId = data.job_id as string | undefined;
      if (!jobId) throw new Error("Server didn't return a job id");
      await poll(jobId);
    } catch (e) {
      setBusy(false);
      setStatusText("");
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className="h-3 w-3" />
        )}
        {busy ? "Refreshing…" : "Refresh"}
      </button>
      {statusText && (
        <span
          className="text-[10px] text-muted-foreground max-w-[280px] truncate"
          title={statusText}
        >
          {statusText}
        </span>
      )}
    </div>
  );
}
