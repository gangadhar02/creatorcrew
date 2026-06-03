/**
 * POST /api/boost
 * Body (new, post-level):
 *   { postId, presetId: PostBoostPresetId, voice_id? }
 * Body (legacy chat-tab):
 *   { postId, action: BoostAction, voice_id? }
 *
 * Creates a new chat with the post as context. For post-level presets we
 * auto-generate a markdown "Remix this post" user message that bundles the
 * source caption + transcript + author so the model never needs to ask for
 * basics. Returns chat_id so the UI can navigate immediately.
 */
import { NextResponse, type NextRequest } from "next/server";
import { BOOST_PRESETS, type BoostAction } from "@/lib/boost-presets";
import {
  POST_BOOST_PRESETS,
  buildPostBoostUserMessage,
  type PostBoostPresetId,
} from "@/lib/post-boost-presets";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import type { PostWithCreator } from "@/lib/discover-types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    postId?: string;
    action?: BoostAction;
    presetId?: PostBoostPresetId;
    voice_id?: string | null;
    chat?: boolean;
  };
  const postId = body.postId;
  if (!postId) {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  // "Chat" path — open a fresh AI chat seeded with the post so the user can
  // ask anything about it. No preset, no forced output shape.
  if (body.chat) {
    const sb = getSupabase();
    const { data: rawPost } = await sb
      .from("creator_posts")
      .select(
        `id, platform, url, media_type, title_or_caption, like_count,
         comment_count, view_count, outlier_multiplier, transcript,
         creator:creators!inner(handle)`
      )
      .eq("id", postId)
      .maybeSingle();
    if (!rawPost) {
      return NextResponse.json({ error: "post not found" }, { status: 404 });
    }
    const p = rawPost as unknown as {
      url: string;
      media_type: string | null;
      title_or_caption: string | null;
      like_count: number;
      comment_count: number;
      view_count: number;
      outlier_multiplier: number | null;
      transcript: string | null;
      creator: { handle: string };
    };
    const stats = [
      `${p.like_count} likes`,
      `${p.comment_count} comments`,
      p.view_count ? `${p.view_count} views` : null,
      p.outlier_multiplier ? `${p.outlier_multiplier.toFixed(2)}× outlier` : null,
    ]
      .filter(Boolean)
      .join(", ");
    const message = [
      `I want to chat about this ${p.media_type || "post"} from @${p.creator.handle}. ` +
        `Give me a short read on it, then let me ask follow-ups.`,
      p.title_or_caption ? `\nCaption:\n${p.title_or_caption}` : "",
      p.transcript ? `\nTranscript:\n${p.transcript}` : "",
      stats ? `\nStats: ${stats}.` : "",
      `\nLink: ${p.url}`,
    ]
      .filter(Boolean)
      .join("\n");
    return await spawnChat(request, {
      context_kind: "creator_post",
      context_id: postId,
      voice_id: body.voice_id ?? null,
      message,
      title: `Chat with @${p.creator.handle}`,
    });
  }

  // New post-level path
  if (body.presetId) {
    const preset = POST_BOOST_PRESETS[body.presetId];
    if (!preset) {
      return NextResponse.json(
        { error: `unknown presetId: ${body.presetId}` },
        { status: 400 }
      );
    }
    const sb = getSupabase();
    const { data: rawPost } = await sb
      .from("creator_posts")
      .select(
        `id, platform, platform_pk, code, url, media_type, title_or_caption,
         like_count, comment_count, view_count, play_count, engagement_rate,
         outlier_multiplier, published_at, thumbnail_url, transcript,
         vision_analysis_md, pillar_id, taxonomy_id, taxonomy_label,
         taxonomy_tier1, content_type_label, media_format, mood, ai_tags,
         ai_description, ai_overview,
         creator:creators!inner(id, handle, display_name, follower_count,
           avatar_url, is_verified, platform, workspace_id)`
      )
      .eq("id", postId)
      .maybeSingle();
    if (!rawPost) {
      return NextResponse.json({ error: "post not found" }, { status: 404 });
    }
    const post = rawPost as unknown as PostWithCreator;
    const userMessage = buildPostBoostUserMessage(preset, post);

    // Mark onboarding complete
    const ws = await getWorkspaceContext();
    if (ws.workspaceId) {
      await sb
        .from("onboarding_progress")
        .upsert(
          {
            workspace_id: ws.workspaceId,
            task_key: "use_boost",
            completed_at: new Date().toISOString(),
          },
          { onConflict: "workspace_id,task_key" }
        );
    }

    return await spawnChat(request, {
      context_kind: "creator_post",
      context_id: postId,
      voice_id: body.voice_id ?? null,
      message: userMessage,
      title: `${preset.title} · ${post.creator.handle}`,
      system_prompt: preset.systemPrompt,
      tool: preset.requiresTool,
    });
  }

  // Legacy chat-tab boost path
  if (body.action) {
    const preset = BOOST_PRESETS[body.action];
    if (!preset) {
      return NextResponse.json(
        { error: `unknown action: ${body.action}` },
        { status: 400 }
      );
    }
    const ws = await getWorkspaceContext();
    if (ws.workspaceId) {
      const sb = getSupabase();
      await sb
        .from("onboarding_progress")
        .upsert(
          {
            workspace_id: ws.workspaceId,
            task_key: "use_boost",
            completed_at: new Date().toISOString(),
          },
          { onConflict: "workspace_id,task_key" }
        );
    }
    return await spawnChat(request, {
      context_kind: "creator_post",
      context_id: postId,
      voice_id: body.voice_id ?? null,
      message: preset.prompt,
      title: `${preset.label} boost`,
    });
  }

  return NextResponse.json(
    { error: "presetId or action required" },
    { status: 400 }
  );
}

async function spawnChat(
  request: NextRequest,
  payload: {
    context_kind: string;
    context_id: string;
    voice_id?: string | null;
    message: string;
    title: string;
    system_prompt?: string;
    tool?: string;
  }
) {
  const chatRes = await fetch(new URL("/api/chat", request.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Forward auth so /api/chat resolves the same workspace (getWorkspaceContext
      // reads the auth cookie). Without this the internal call is unauthenticated
      // and chat creation fails with "no workspace".
      cookie: request.headers.get("cookie") || "",
    },
    body: JSON.stringify(payload),
  });
  if (!chatRes.body || !chatRes.ok) {
    return NextResponse.json(
      { error: `chat create failed: HTTP ${chatRes.status}` },
      { status: 500 }
    );
  }
  const reader = chatRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let chatId = "";
  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line) as {
          type: string;
          chat_id?: string;
          message?: string;
        };
        if (ev.type === "start" && ev.chat_id) {
          chatId = ev.chat_id;
          break outer;
        }
        if (ev.type === "error") {
          return NextResponse.json(
            { error: ev.message || "chat error" },
            { status: 500 }
          );
        }
      } catch {
        /* partial */
      }
    }
  }
  // Drain rest in background so the chat finishes server-side.
  (async () => {
    try {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    } catch {
      /* ignore */
    }
  })();
  return NextResponse.json({ ok: true, chat_id: chatId });
}
