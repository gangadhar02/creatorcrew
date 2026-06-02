/**
 * POST /api/profiles/analyze
 *
 * Two modes depending on deploy environment:
 *
 *   QUEUED MODE (production / Vercel):
 *     - Insert an analyzer_jobs row with status='queued'
 *     - Trigger .github/workflows/analyze-profile.yml via the GitHub REST
 *       API (workflow_dispatch). Inputs: { job_id }
 *     - Return { job_id } immediately so the client can poll.
 *     - Why: Instagram rate-limits Vercel's AWS IP space aggressively;
 *       GitHub Actions runners use different IPs.
 *
 *   INLINE MODE (local dev fallback):
 *     - Activated when ANALYZER_DISPATCH_TOKEN is not set.
 *     - Runs runProfileAnalysis() directly in the request.
 *     - Inserts an analyzer_jobs row only to surface progress; updates
 *       it to 'completed'/'failed' before returning.
 *     - Why: local dev hits IG fine and waiting 60s for a GH runner is
 *       annoying when iterating.
 *
 * Body: { handle: string, maxPosts?: number }
 * Returns: { job_id, mode } on success.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import { runProfileAnalysis, DEFAULT_PROFILE_CAP } from "@/lib/profile-analyzer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Skip re-analyzing a profile synced within this many days (unless force=true).
 *  Set PROFILE_FRESH_DAYS=0 to disable the freshness guard entirely. */
const FRESH_DAYS = Number(process.env.PROFILE_FRESH_DAYS ?? 7);

const GITHUB_OWNER = process.env.GITHUB_REPO_OWNER || "gangadhar02";
const GITHUB_REPO = process.env.GITHUB_REPO_NAME || "creatorcrew";
const GITHUB_REF = process.env.GITHUB_REPO_REF || "main";
const WORKFLOW_FILE = "analyze-profile.yml";

function cleanHandle(input: string): string {
  return input.replace(/^@/, "").trim().toLowerCase();
}

async function dispatchAnalyzerWorkflow(jobId: string): Promise<string | null> {
  const token = process.env.ANALYZER_DISPATCH_TOKEN;
  if (!token) return null;

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref: GITHUB_REF,
      inputs: { job_id: jobId },
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `GitHub workflow dispatch failed (${res.status}): ${errText.slice(0, 200)}`
    );
  }
  // GitHub doesn't return the run URL synchronously; closest we can do
  // is point to the workflow's run list. The CLI updates workflow_run_url
  // later if we want; for now this is good enough for UI.
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}`;
}

export async function POST(request: NextRequest) {
  try {
    return await handlePost(request);
  } catch (e) {
    // Top-level safety net so the client never sees an HTML error page.
    // Anything that escaped the inner try/catch (env var throws, JSON
    // body parse failure, Supabase client errors before we have a job
    // row, etc.) is converted to a structured JSON response.
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/profiles/analyze] unhandled:", msg);
    return NextResponse.json(
      { error: `analyze failed: ${msg.slice(0, 500)}` },
      { status: 500 }
    );
  }
}

async function handlePost(request: NextRequest) {
  let parsedBody: { handle?: string; maxPosts?: number; force?: boolean };
  try {
    parsedBody = (await request.json()) as {
      handle: string;
      maxPosts?: number;
      force?: boolean;
    };
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON: { handle: string, maxPosts?: number, force?: boolean }" },
      { status: 400 }
    );
  }
  const handleRaw = parsedBody.handle;
  const maxPosts = parsedBody.maxPosts;
  const force = parsedBody.force === true;
  if (!handleRaw) {
    return NextResponse.json({ error: "handle required" }, { status: 400 });
  }

  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 401 });
  }

  const handle = cleanHandle(handleRaw);
  const cap = Math.max(1, Math.min(maxPosts ?? DEFAULT_PROFILE_CAP, 500));
  const sb = getSupabase();

  // Freshness guard — skip a re-analysis if this profile was synced recently
  // and the caller didn't force it. Checked BEFORE creating a job or dispatching
  // to GitHub Actions so a fresh profile costs nothing (no Apify, no CI run).
  if (!force && FRESH_DAYS > 0) {
    const existing = await sb
      .from("profiles")
      .select("id, last_synced_at, sync_status")
      .eq("ig_handle", handle)
      .eq("workspace_id", ws.workspaceId)
      .maybeSingle();
    const row = existing.data as
      | { id: string; last_synced_at: string | null; sync_status: string | null }
      | null;
    if (row?.last_synced_at && row.sync_status !== "failed") {
      const ageMs = Date.now() - new Date(row.last_synced_at).getTime();
      if (ageMs < FRESH_DAYS * 86_400_000) {
        const ageHours = Math.round(ageMs / 3_600_000);
        return NextResponse.json({
          mode: "skipped",
          skipped: true,
          job_id: null,
          profile_id: row.id,
          handle,
          last_synced_at: row.last_synced_at,
          reason: `Analyzed ${ageHours}h ago (within ${FRESH_DAYS}-day freshness window). Use Refresh to force a re-fetch.`,
        });
      }
    }
  }

  // Create the job row up front so we always have something to poll.
  const jobIns = await sb
    .from("analyzer_jobs")
    .insert({
      workspace_id: ws.workspaceId,
      handle,
      cap,
      status: "queued",
    })
    .select("id")
    .single();
  if (jobIns.error || !jobIns.data) {
    return NextResponse.json(
      { error: jobIns.error?.message || "could not create job" },
      { status: 500 }
    );
  }
  const jobId = (jobIns.data as { id: string }).id;

  const hasDispatchToken = !!process.env.ANALYZER_DISPATCH_TOKEN;
  const onVercel = !!process.env.VERCEL;

  // On Vercel (serverless) the inline path can't finish before the function
  // timeout (10s on Hobby, 60s on Pro) since an IG scrape takes 30-90s. Fail
  // fast with a clear setup hint instead of running and timing out.
  if (onVercel && !hasDispatchToken) {
    await sb
      .from("analyzer_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message:
          "Queue not configured: ANALYZER_DISPATCH_TOKEN missing in Vercel env vars",
      })
      .eq("id", jobId);
    return NextResponse.json(
      {
        job_id: jobId,
        mode: "queued",
        error:
          "Profile Analyzer queue is not wired up on this deploy. Set ANALYZER_DISPATCH_TOKEN (a GitHub PAT with Actions write on this repo) in Vercel → Settings → Environment Variables, then redeploy.",
      },
      { status: 503 }
    );
  }

  // ============================================================================
  // QUEUED MODE — production. Fire-and-forget GitHub workflow dispatch.
  // ============================================================================
  if (hasDispatchToken) {
    try {
      const workflowUrl = await dispatchAnalyzerWorkflow(jobId);
      if (workflowUrl) {
        await sb
          .from("analyzer_jobs")
          .update({ workflow_run_url: workflowUrl })
          .eq("id", jobId);
      }
      return NextResponse.json({ job_id: jobId, mode: "queued" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sb
        .from("analyzer_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: `Dispatch failed: ${msg.slice(0, 1000)}`,
        })
        .eq("id", jobId);
      return NextResponse.json(
        { job_id: jobId, mode: "queued", error: msg },
        { status: 502 }
      );
    }
  }

  // ============================================================================
  // INLINE MODE — local dev. Run synchronously, return when done.
  // ============================================================================
  await sb
    .from("analyzer_jobs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", jobId);

  try {
    const result = await runProfileAnalysis({
      workspaceId: ws.workspaceId,
      handle,
      cap,
    });
    await sb
      .from("analyzer_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        creator_id: result.creatorId,
        profile_id: result.profileId,
        posts_synced: result.postsCached,
      })
      .eq("id", jobId);
    return NextResponse.json({
      job_id: jobId,
      mode: "inline",
      profile_id: result.profileId,
      creator_id: result.creatorId,
      handle: result.handle,
      posts_cached: result.postsCached,
      typical_reel_views: result.typicalReelViews,
      typical_post_likes: result.typicalPostLikes,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb
      .from("analyzer_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: msg.slice(0, 2000),
      })
      .eq("id", jobId);
    return NextResponse.json(
      { job_id: jobId, mode: "inline", error: msg },
      { status: 500 }
    );
  }
}
