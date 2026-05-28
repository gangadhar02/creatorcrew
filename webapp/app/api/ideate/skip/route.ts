/**
 * POST /api/ideate/skip
 * Body: { save_id: string }
 *
 * Marks the save as 'Reviewed' (we considered it, didn't take it).
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const sb = getSupabase();
  const { save_id } = (await request.json()) as { save_id: string };
  if (!save_id) {
    return NextResponse.json({ error: "save_id required" }, { status: 400 });
  }
  const { error } = await sb
    .from("saves")
    .update({ status: "Reviewed" })
    .eq("id", save_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
