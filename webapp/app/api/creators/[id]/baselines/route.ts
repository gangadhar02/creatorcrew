/**
 * GET  /api/creators/[id]/baselines — return baseline rows
 * POST /api/creators/[id]/baselines — recompute baselines for this creator
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import { computeBaselinesForCreator } from "@/lib/outlier";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/** Verify the creator belongs to the caller's workspace (creators has workspace_id). */
async function ownsCreator(
  sb: SupabaseClient,
  creatorId: string,
  workspaceId: string
): Promise<boolean> {
  const { data } = await sb
    .from("creators")
    .select("id")
    .eq("id", creatorId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return !!data;
}

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const sb = getSupabase();
  if (!(await ownsCreator(sb, id, ws.workspaceId)))
    return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data } = await sb
    .from("outlier_baselines")
    .select("*")
    .eq("creator_id", id);
  return NextResponse.json({ baselines: data || [] });
}

export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const sb = getSupabase();
  if (!(await ownsCreator(sb, id, ws.workspaceId)))
    return NextResponse.json({ error: "not found" }, { status: 404 });
  const baselines = await computeBaselinesForCreator(id);
  return NextResponse.json({ baselines });
}
