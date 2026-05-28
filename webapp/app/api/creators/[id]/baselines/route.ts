/**
 * GET  /api/creators/[id]/baselines — return baseline rows
 * POST /api/creators/[id]/baselines — recompute baselines for this creator
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { computeBaselinesForCreator } from "@/lib/outlier";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const sb = getSupabase();
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
  const { id } = await ctx.params;
  const baselines = await computeBaselinesForCreator(id);
  return NextResponse.json({ baselines });
}
