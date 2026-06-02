/**
 * PATCH /api/onboarding
 * Body: { task_key: 'build_voice' | 'create_board' | 'use_boost' | 'add_creator_to_list' }
 *
 * Marks an onboarding task complete for the current workspace. Idempotent —
 * safe to call multiple times.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

const VALID_KEYS = new Set([
  "build_voice",
  "create_board",
  "use_boost",
  "add_creator_to_list",
]);

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as { task_key?: string };
  if (!body.task_key || !VALID_KEYS.has(body.task_key)) {
    return NextResponse.json(
      { error: `task_key must be one of: ${Array.from(VALID_KEYS).join(", ")}` },
      { status: 400 }
    );
  }
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) {
    return NextResponse.json(
      { error: "No workspace. Apply migration 003" },
      { status: 500 }
    );
  }
  const sb = getSupabase();
  const { error } = await sb
    .from("onboarding_progress")
    .upsert(
      {
        workspace_id: ws.workspaceId,
        task_key: body.task_key,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,task_key" }
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
