/**
 * GET /api/pillars/taxonomy — list all pillar_taxonomy rows seeded in migration_011.
 */
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("pillar_taxonomy")
    .select("*")
    .order("position", { ascending: true });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ taxonomy: data || [] });
}
