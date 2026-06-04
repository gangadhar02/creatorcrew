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
import { createVoiceRow } from "@/lib/voice-create";
import type { Voice } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    kind: "links" | "archetype" | "chat";
    urls?: string[];
    archetypeId?: string;
    conversation?: { role: "user" | "assistant"; content: string }[];
    saveToBoard?: boolean;
  };
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 500 });
  }
  const sb = getSupabase();

  let payload: Partial<Voice>;
  let linkUrls: string[] = [];

  try {
    if (body.kind === "links") {
      linkUrls = (body.urls || []).filter((u) => u && u.trim().length > 0);
      if (linkUrls.length === 0) {
        return NextResponse.json(
          { error: "links required" },
          { status: 400 }
        );
      }
      payload = await extractVoiceFromLinks(linkUrls);
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

  try {
    const voiceId = await createVoiceRow(ws.workspaceId, payload);
    if (body.kind === "links" && body.saveToBoard && linkUrls.length > 0) {
      // Best-effort: drop the source links onto a "Voice Sources" board so the
      // user can return to them. Never blocks the voice creation.
      try {
        await saveLinksToBoard(ws.workspaceId, linkUrls);
      } catch (e) {
        console.warn("[voice/extract] saveToBoard failed:", e);
      }
    }
    return NextResponse.json({ ok: true, voice_id: voiceId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

/** Find or create a "Voice Sources" board and add each link as a card. */
async function saveLinksToBoard(workspaceId: string, urls: string[]) {
  const sb = getSupabase();
  const existing = await sb
    .from("boards")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("kind", "board")
    .eq("name", "Voice Sources")
    .limit(1)
    .maybeSingle();
  let boardId = (existing.data as { id: string } | null)?.id;
  if (!boardId) {
    const ins = await sb
      .from("boards")
      .insert({
        workspace_id: workspaceId,
        name: "Voice Sources",
        description: "Links you used to build your voice.",
        kind: "board",
      })
      .select("id")
      .single();
    boardId = (ins.data as { id: string } | null)?.id;
  }
  if (!boardId) return;

  const posRes = await sb
    .from("board_items")
    .select("position")
    .eq("board_id", boardId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  let pos = ((posRes.data as { position: number } | null)?.position ?? -1) + 1;

  for (const url of urls) {
    const card = await sb
      .from("cards")
      .insert({ body_md: url })
      .select("id")
      .single();
    const cardId = (card.data as { id: string } | null)?.id;
    if (!cardId) continue;
    await sb.from("board_items").insert({
      board_id: boardId,
      kind: "card",
      card_id: cardId,
      position: pos++,
    });
  }
}
