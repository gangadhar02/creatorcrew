/**
 * POST /api/profile-posts/[id]/analyze
 * Re-fetches the media, runs Gemini vision deconstruction, stores markdown.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import { runGeminiOnMedia, POST_VISION_PROMPT } from "@/lib/gemini-media";
import { mirrorVisionToCreatorPost } from "@/lib/dual-write";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const sb = getSupabase();
  const ws = await getWorkspaceContext();
  const { data } = await sb
    .from("profile_posts")
    .select("id, media_pk")
    .eq("id", id)
    .eq("workspace_id", ws.workspaceId)
    .maybeSingle();
  const post = data as { id: string; media_pk: string } | null;
  if (!post) {
    return NextResponse.json({ error: "post not found" }, { status: 404 });
  }
  try {
    const { text } = await runGeminiOnMedia(post.media_pk, POST_VISION_PROMPT, {
      model: "gemini-2.5-flash",
    });
    await sb
      .from("profile_posts")
      .update({ vision_analysis_md: text })
      .eq("id", id);
    // Mirror into the unified creator_posts table.
    await mirrorVisionToCreatorPost(post.media_pk, text);
    return NextResponse.json({ ok: true, vision_analysis_md: text });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
