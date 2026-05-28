/**
 * POST /api/files/upload — multipart upload to Supabase Storage 'board-files' bucket.
 * Returns the created `files` row.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

function classifyKind(mimeType: string): "image" | "pdf" | "file" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  return "file";
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  const sb = getSupabase();
  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${ts}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await sb.storage
    .from("board-files")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) {
    return NextResponse.json(
      { error: `storage: ${upErr.message}` },
      { status: 500 }
    );
  }

  const { data: row, error: rowErr } = await sb
    .from("files")
    .insert({
      kind: classifyKind(file.type || ""),
      storage_bucket: "board-files",
      storage_path: storagePath,
      original_name: file.name,
      size_bytes: file.size,
      mime_type: file.type || null,
    })
    .select("*")
    .single();
  if (rowErr) {
    return NextResponse.json({ error: rowErr.message }, { status: 500 });
  }
  return NextResponse.json({ file: row });
}
