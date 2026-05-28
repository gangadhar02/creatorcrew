/**
 * GET /api/files/[id]/signed-url — returns a short-lived signed URL for the file.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const sb = getSupabase();
  const { data: file } = await sb
    .from("files")
    .select("storage_bucket, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!file) return NextResponse.json({ error: "not found" }, { status: 404 });
  const f = file as { storage_bucket: string; storage_path: string };
  const { data, error } = await sb.storage
    .from(f.storage_bucket)
    .createSignedUrl(f.storage_path, 60 * 60); // 1h
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "signing failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ url: data.signedUrl });
}
