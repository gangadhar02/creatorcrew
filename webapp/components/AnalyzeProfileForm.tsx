"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type JobStatus = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  handle: string;
  cap: number;
  posts_synced: number;
  error_message: string | null;
  creator_id: string | null;
  profile_id: string | null;
  workflow_run_url: string | null;
  enqueued_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export default function AnalyzeProfileForm() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [maxPosts, setMaxPosts] = useState<number>(40);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobStatus | null>(null);

  // Poll job status while it's queued/running.
  useEffect(() => {
    if (!job) return;
    if (job.status === "completed" || job.status === "failed") return;

    const tick = async () => {
      try {
        const res = await fetch(`/api/profiles/analyze/${job.id}`);
        if (!res.ok) return;
        const text = await res.text();
        if (!text) return;
        let data: JobStatus;
        try {
          data = JSON.parse(text) as JobStatus;
        } catch {
          // Server returned HTML / text — surface it instead of silently
          // dying with "Unexpected token A". Stop polling on this.
          setError(
            `Polling failed (HTTP ${res.status}). ${text.slice(0, 200)}`
          );
          setJob((j) =>
            j
              ? {
                  ...j,
                  status: "failed",
                  error_message: `Non-JSON response from status endpoint`,
                }
              : null
          );
          return;
        }
        setJob(data);
        if (data.status === "completed") {
          router.push(`/profiles/${data.handle}`);
          router.refresh();
        }
      } catch {
        // network blip — keep polling
      }
    };
    const interval = setInterval(tick, 3000);
    // Fire one immediately so a quick local-mode job updates without
    // waiting 3 seconds.
    tick();
    return () => clearInterval(interval);
  }, [job, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!handle.trim()) return;
    setSubmitting(true);
    setError(null);
    setJob(null);
    try {
      const res = await fetch("/api/profiles/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: handle.trim(),
          maxPosts: Math.max(1, Math.min(500, maxPosts || 40)),
        }),
      });
      // Some failure modes (Vercel 502/504, framework error pages)
      // return HTML — don't crash on JSON.parse.
      const text = await res.text();
      let data: { mode?: string; handle?: string; job_id?: string; error?: string };
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          `Server returned non-JSON (HTTP ${res.status}). ${text.slice(0, 200)}`
        );
      }
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      // QUEUED MODE returns just { job_id, mode }. Seed a queued job so
      // the polling effect kicks in.
      // INLINE MODE returns the full result fields — we synthesize a
      // "completed" job so the same render path applies.
      // Inline = ran now; skipped = already fresh (freshness guard). Either way
      // the profile exists — just navigate to it.
      if (data.mode === "inline" || data.mode === "skipped") {
        router.push(`/profiles/${data.handle}`);
        router.refresh();
        return;
      }
      if (!data.job_id) {
        throw new Error("Server didn't return a job id");
      }
      setJob({
        id: data.job_id,
        status: "queued",
        handle: handle.trim().replace(/^@/, "").toLowerCase(),
        cap: maxPosts,
        posts_synced: 0,
        error_message: null,
        creator_id: null,
        profile_id: null,
        workflow_run_url: null,
        enqueued_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || (job ? job.status === "queued" || job.status === "running" : false);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@username or username"
          disabled={busy}
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
              const n = parseInt(raw || "40", 10);
              setMaxPosts(Number.isFinite(n) ? n : 40);
            }}
            disabled={busy}
            className="w-14 bg-transparent py-1.5 text-sm tabular-nums focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !handle.trim()}
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
        >
          {submitting ? "Submitting…" : busy ? statusLabel(job?.status) : "Analyze"}
        </button>
      </form>

      {/* Queue progress for production mode. Inline mode redirects on success
          so it never lingers here. */}
      {job && job.status !== "completed" && (
        <div className="mt-3 rounded-md border border-[var(--border)] bg-background/60 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {job.status === "queued"
                ? `Queued @${job.handle}…`
                : job.status === "running"
                  ? `Analyzing @${job.handle}…`
                  : job.status === "failed"
                    ? `Failed: @${job.handle}`
                    : ""}
            </span>
            <span className="text-[var(--muted-foreground)]">
              {job.posts_synced > 0 && `${job.posts_synced} posts`}
            </span>
          </div>
          {job.status === "queued" && (
            <p className="mt-1 text-[var(--muted-foreground)]">
              GitHub Actions takes ~30–60s to spin up a runner, then ~30–90s
              to fetch posts. Total: usually under 2 minutes.
              {job.workflow_run_url && (
                <>
                  {" "}
                  <a
                    href={job.workflow_run_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    View workflow
                  </a>
                </>
              )}
            </p>
          )}
          {job.status === "failed" && job.error_message && (
            <p className="mt-1 text-rose-600 dark:text-rose-400">
              {job.error_message}
            </p>
          )}
        </div>
      )}

      {!job && !submitting && (
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          Range: 1–500 posts. Default 40. Higher = more data but higher fetch
          cost. Recently-analyzed profiles are reused automatically. Use Refresh
          to force a re-fetch. Production runs go through GitHub Actions (~1–2
          min); local dev runs inline.
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
}

function statusLabel(status: JobStatus["status"] | undefined): string {
  switch (status) {
    case "queued":
      return "Queued…";
    case "running":
      return "Analyzing…";
    case "failed":
      return "Retry";
    default:
      return "Working…";
  }
}
