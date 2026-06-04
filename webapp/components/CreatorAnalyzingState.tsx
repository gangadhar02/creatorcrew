"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";

type JobStatus = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  handle: string;
  posts_synced: number;
  error_message: string | null;
  workflow_run_url: string | null;
};

/**
 * Shown on the creator detail page when the creator row doesn't exist yet but a
 * profile analysis is queued/running for that handle. In production, adding an
 * Instagram creator dispatches a GitHub Actions job and returns immediately, so
 * the creator + posts land a minute or two later. Without this, the redirect to
 * the detail page 404s until the job finishes. We poll the job and refresh the
 * route the moment it completes, so the freshly analyzed creator appears in place.
 */
export default function CreatorAnalyzingState({
  jobId,
  handle,
  initialStatus,
}: {
  jobId: string;
  handle: string;
  initialStatus?: "queued" | "running";
}) {
  const router = useRouter();
  const [status, setStatus] = useState<JobStatus["status"]>(
    initialStatus ?? "queued"
  );
  const [postsSynced, setPostsSynced] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [workflowUrl, setWorkflowUrl] = useState<string | null>(null);

  useEffect(() => {
    if (status === "completed" || status === "failed") return;

    const tick = async () => {
      try {
        const res = await fetch(`/api/profiles/analyze/${jobId}`);
        if (!res.ok) return;
        const text = await res.text();
        if (!text) return;
        let data: JobStatus;
        try {
          data = JSON.parse(text) as JobStatus;
        } catch {
          return;
        }
        setStatus(data.status);
        setPostsSynced(data.posts_synced ?? 0);
        setWorkflowUrl(data.workflow_run_url ?? null);
        if (data.status === "failed") {
          setError(data.error_message || "Analysis failed.");
        }
        if (data.status === "completed") {
          // The creator + posts now exist; re-render the server page in place.
          router.refresh();
        }
      } catch {
        // network blip — keep polling
      }
    };

    const interval = setInterval(tick, 3000);
    tick();
    return () => clearInterval(interval);
  }, [jobId, status, router]);

  if (status === "failed") {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center">
        <AlertCircle className="mx-auto mb-3 h-6 w-6 text-destructive" />
        <p className="text-sm font-medium text-foreground">
          Couldn&apos;t analyze @{handle}
        </p>
        {error && (
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
        <div>
          <h1 className="text-lg font-semibold tracking-[-0.02em]">
            Analyzing @{handle}…
          </h1>
          <p className="text-sm text-muted-foreground">
            {status === "queued"
              ? "Queued. GitHub Actions spins up a runner (~30–60s), then fetches posts."
              : "Fetching posts and computing metrics…"}
            {postsSynced > 0 && ` ${postsSynced} posts so far.`}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        This usually takes under 2 minutes. The page updates automatically when
        it&apos;s ready.
        {workflowUrl && (
          <>
            {" "}
            <a
              href={workflowUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              View workflow
            </a>
          </>
        )}
      </div>
    </div>
  );
}
