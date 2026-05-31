import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

/**
 * POST /api/profile/avatar (multipart: file=...)
 * Uploads the user's avatar to the social-mirror storage bucket and returns a
 * public URL. The client then saves that URL into auth user_metadata.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "social-mirror";

export async function POST(request: NextRequest) {
  const ws = await getWorkspaceContext();
  if (!ws.userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  const f = file as File;
  if (f.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Image too large (max 5 MB)." },
      { status: 400 }
    );
  }

  const ext = (f.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const path = `avatars/${ws.userId}.${ext}`;
  const sb = getSupabase();
  try {
    const buf = Buffer.from(await f.arrayBuffer());
    const { error } = await sb.storage.from(BUCKET).upload(path, buf, {
      contentType: f.type || "image/jpeg",
      upsert: true,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    // Cache-bust so a re-upload to the same path shows immediately.
    return NextResponse.json({ ok: true, url: `${data.publicUrl}?v=${Date.now()}` });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
