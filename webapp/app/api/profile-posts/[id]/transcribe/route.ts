/**
 * POST /api/profile-posts/[id]/transcribe
 * Re-fetches the media from IG, downloads the video, uploads to Gemini, and
 * stores the audio transcript on the row.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { runGeminiOnMedia, TRANSCRIBE_PROMPT } from "@/lib/gemini-media";
import { mirrorTranscriptToCreatorPost } from "@/lib/dual-write";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const sb = getSupabase();
  const { data } = await sb
    .from("profile_posts")
    .select("id, media_pk, type")
    .eq("id", id)
    .maybeSingle();
  const post = data as { id: string; media_pk: string; type: string } | null;
  if (!post) {
    return NextResponse.json({ error: "post not found" }, { status: 404 });
  }
  try {
    const { text } = await runGeminiOnMedia(post.media_pk, TRANSCRIBE_PROMPT, {
      model: "gemini-2.5-flash",
    });
    await sb
      .from("profile_posts")
      .update({ transcript: text })
      .eq("id", id);
    await mirrorTranscriptToCreatorPost(post.media_pk, text);
    return NextResponse.json({ ok: true, transcript: text });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
