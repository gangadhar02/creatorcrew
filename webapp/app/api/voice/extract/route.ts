/**
 * POST /api/voice/extract
 * Body: { kind: 'links' | 'archetype' | 'chat', urls?, archetypeId?, conversation? }
 *
 * Creates a new voice row in the current workspace.
 * - links: scrapes the URLs, runs Gemini extraction
 * - archetype: clones an archetype voice into the workspace
 * - chat: takes a conversation transcript, runs Gemini extraction
 *
 * Returns the created voice id.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import {
  extractVoiceFromLinks,
  extractVoiceFromChat,
} from "@/lib/extract-voice";
import type { Voice } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    kind: "links" | "archetype" | "chat";
    urls?: string[];
    archetypeId?: string;
    conversation?: { role: "user" | "assistant"; content: string }[];
  };
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 500 });
  }
  const sb = getSupabase();

  let payload: Partial<Voice>;

  try {
    if (body.kind === "links") {
      const urls = (body.urls || []).filter((u) => u && u.trim().length > 0);
      if (urls.length === 0) {
        return NextResponse.json(
          { error: "links required" },
          { status: 400 }
        );
      }
      payload = await extractVoiceFromLinks(urls);
    } else if (body.kind === "archetype") {
      if (!body.archetypeId) {
        return NextResponse.json(
          { error: "archetypeId required" },
          { status: 400 }
        );
      }
      const { data: arch } = await sb
        .from("voices")
        .select("*")
        .eq("id", body.archetypeId)
        .eq("is_archetype", true)
        .maybeSingle();
      if (!arch) {
        return NextResponse.json(
          { error: "archetype not found" },
          { status: 404 }
        );
      }
      const a = arch as Voice;
      payload = {
        name: a.name,
        archetype: a.archetype,
        mission_md: a.mission_md,
        audience_md: a.audience_md,
        pov_md: a.pov_md,
        core_ideas_md: a.core_ideas_md,
        vocabulary: a.vocabulary,
        tone_md: a.tone_md,
        always_do_md: a.always_do_md,
        avoid_md: a.avoid_md,
        formatting_md: a.formatting_md,
        writing_samples_md: a.writing_samples_md,
      };
    } else if (body.kind === "chat") {
      const conv = body.conversation || [];
      if (conv.length === 0) {
        return NextResponse.json(
          { error: "conversation required" },
          { status: 400 }
        );
      }
      payload = await extractVoiceFromChat(conv);
    } else {
      return NextResponse.json({ error: "unknown kind" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  const row = {
    workspace_id: ws.workspaceId,
    name: payload.name || "Untitled voice",
    archetype: payload.archetype || null,
    mission_md: payload.mission_md || null,
    audience_md: payload.audience_md || null,
    pov_md: payload.pov_md || null,
    core_ideas_md: payload.core_ideas_md || null,
    vocabulary: payload.vocabulary || {},
    tone_md: payload.tone_md || null,
    always_do_md: payload.always_do_md || null,
    avoid_md: payload.avoid_md || null,
    formatting_md: payload.formatting_md || null,
    writing_samples_md: payload.writing_samples_md || null,
    source_links: payload.source_links || [],
    is_default: false,
    is_archetype: false,
  };

  const { data, error } = await sb
    .from("voices")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "insert failed" },
      { status: 500 }
    );
  }

  // Auto-mark onboarding 'build_voice' complete (fire and forget)
  await sb
    .from("onboarding_progress")
    .upsert(
      {
        workspace_id: ws.workspaceId,
        task_key: "build_voice",
        completed_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,task_key" }
    );

  return NextResponse.json({ ok: true, voice_id: (data as { id: string }).id });
}
