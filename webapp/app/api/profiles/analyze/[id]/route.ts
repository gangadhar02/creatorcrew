/**
 * GET /api/profiles/analyze/[id]
 *
 * Status poll for an analyzer_jobs row. Workspace-scoped — rejects
 * requests for jobs belonging to other users.
 *
 * Response shape:
 *   { id, status, handle, cap, posts_synced, error_message,
 *     creator_id, profile_id, workflow_run_url,
 *     enqueued_at, started_at, completed_at }
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 });
  }

  const sb = getSupabase();
  const res = await sb
    .from("analyzer_jobs")
    .select(
      "id, workspace_id, handle, cap, status, error_message, posts_synced, creator_id, profile_id, workflow_run_url, enqueued_at, started_at, completed_at"
    )
    .eq("id", id)
    .maybeSingle();
  const job = res.data as
    | {
        id: string;
        workspace_id: string;
        handle: string;
        cap: number;
        status: string;
        error_message: string | null;
        posts_synced: number | null;
        creator_id: string | null;
        profile_id: string | null;
        workflow_run_url: string | null;
        enqueued_at: string;
        started_at: string | null;
        completed_at: string | null;
      }
    | null;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.workspace_id !== ws.workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    handle: job.handle,
    cap: job.cap,
    posts_synced: job.posts_synced ?? 0,
    error_message: job.error_message,
    creator_id: job.creator_id,
    profile_id: job.profile_id,
    workflow_run_url: job.workflow_run_url,
    enqueued_at: job.enqueued_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
  });
}
