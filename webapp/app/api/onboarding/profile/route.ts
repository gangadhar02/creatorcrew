/**
 * POST /api/onboarding/profile
 *
 * Saves the first-run onboarding profile and/or marks the onboarding flow as
 * done. Profile fields land in auth user_metadata (display_name, account_type,
 * building, topics); the workspace name updates the workspaces row.
 *
 * Body: {
 *   accountType?: "self" | "team",
 *   displayName?: string,
 *   workspaceName?: string,
 *   building?: string,
 *   topics?: string,
 *   complete?: boolean,   // when true, sets user_metadata.onboarded = true
 * }
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown, max = 400): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

export async function POST(request: NextRequest) {
  const ws = await getWorkspaceContext();
  if (!ws.userId || !ws.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    accountType?: string;
    displayName?: string;
    workspaceName?: string;
    building?: string;
    topics?: string;
    complete?: boolean;
  };

  const sb = getSupabase();

  // 1) Workspace name (own row only).
  const workspaceName = str(body.workspaceName, 80);
  if (workspaceName) {
    await sb
      .from("workspaces")
      .update({ name: workspaceName })
      .eq("id", ws.workspaceId);
  }

  // 2) Profile fields + completion flag into user_metadata (merge with current).
  const { data: current } = await sb.auth.admin.getUserById(ws.userId);
  const meta = (current?.user?.user_metadata || {}) as Record<string, unknown>;

  const displayName = str(body.displayName, 80);
  const accountType =
    body.accountType === "team" || body.accountType === "self"
      ? body.accountType
      : undefined;
  const building = str(body.building, 600);
  const topics = str(body.topics, 600);

  const nextMeta: Record<string, unknown> = { ...meta };
  if (displayName !== undefined) nextMeta.display_name = displayName;
  if (accountType !== undefined) nextMeta.account_type = accountType;
  if (building !== undefined) nextMeta.building = building;
  if (topics !== undefined) nextMeta.topics = topics;
  if (body.complete === true) nextMeta.onboarded = true;

  const { error } = await sb.auth.admin.updateUserById(ws.userId, {
    user_metadata: nextMeta,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
