#!/usr/bin/env tsx
/**
 * scripts/analyze-profile.ts
 *
 * Runs inside GitHub Actions. Reads a job id from argv[2] (or JOB_ID env),
 * loads the analyzer_jobs row, runs runProfileAnalysis(), and writes the
 * result back to the same row.
 *
 * Invocation (CI):
 *   npx tsx scripts/analyze-profile.ts <job_id>
 *
 * Required env (all set as GitHub repo secrets):
 *   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL — both supported below)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   IG_SCRAPE_SESSION_ID, IG_SCRAPE_CSRFTOKEN, IG_SCRAPE_USER_ID
 *   GEMINI_API_KEY (optional — only needed if downstream enrichment fires)
 */
import { createClient } from "@supabase/supabase-js";
import { runProfileAnalysis } from "../lib/profile-analyzer";

async function main() {
  const jobId = process.argv[2] || process.env.JOB_ID;
  if (!jobId) {
    console.error("Missing job id. Usage: analyze-profile.ts <job_id>");
    process.exit(1);
  }

  // Allow either NEXT_PUBLIC_SUPABASE_URL (Vercel-style) or SUPABASE_URL
  // (Actions secret naming). Same key, two common spellings.
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env. Aborting."
    );
    process.exit(1);
  }
  // Re-export so lib/supabase.ts (which reads NEXT_PUBLIC_SUPABASE_URL)
  // works whether the CI secret was named SUPABASE_URL or the canonical one.
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;

  const sb = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Load the job.
  const jobRes = await sb
    .from("analyzer_jobs")
    .select("id, workspace_id, handle, cap, status")
    .eq("id", jobId)
    .maybeSingle();
  const job = jobRes.data as
    | {
        id: string;
        workspace_id: string;
        handle: string;
        cap: number;
        status: string;
      }
    | null;
  if (!job) {
    console.error(`Job ${jobId} not found.`);
    process.exit(1);
  }
  if (job.status === "completed") {
    console.log(`Job ${jobId} already completed; nothing to do.`);
    process.exit(0);
  }

  console.log(`Starting analyzer for @${job.handle} (cap=${job.cap})…`);
  const startedAt = new Date().toISOString();
  await sb
    .from("analyzer_jobs")
    .update({ status: "running", started_at: startedAt })
    .eq("id", job.id);

  try {
    const result = await runProfileAnalysis({
      workspaceId: job.workspace_id,
      handle: job.handle,
      cap: job.cap,
    });

    await sb
      .from("analyzer_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        creator_id: result.creatorId,
        profile_id: result.profileId,
        posts_synced: result.postsCached,
        error_message: null,
      })
      .eq("id", job.id);

    console.log(
      `Done. profile=${result.profileId} creator=${result.creatorId} posts=${result.postsCached}`
    );
    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Analyzer failed:", msg);
    await sb
      .from("analyzer_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: msg.slice(0, 2000),
      })
      .eq("id", job.id);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
