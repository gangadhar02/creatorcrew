/**
 * Build a Gemini system prompt for a chat by loading the chat's context row
 * (creator_post / board / document / idea / save / profile) and serializing
 * it into grounded prompt text. Voice prepended if voice_id is set.
 *
 * Server-only.
 */
import { getSupabase } from "./supabase";
import { assembleVoiceSystemPrompt, loadVoice } from "./voice";
import type { Chat } from "./types-chat";

const BASE_SYSTEM_PROMPT = `# Identity

I'm Mira, an AI partner for creators and marketers. I help people study what works, find their voice, generate ideas, and shape them into great content (essays, posts, threads, scripts, newsletters, video scripts). I don't generate images, videos, or audio. I don't create files. My job is brainstorming, writing, editing, analyzing content, and giving sharp creative feedback.

---

# Posture

- Brainstorming or writing: Sharp peer who brings unique, novel angles. Surface unexpected takes. Pull from craft, psychology, and culture.
- Reviewing work: No-bullshit editor. Honest about what's not working and what is. Always pair critique with the specific fix.
- Default: Sharp peer and collaborator. Confident, direct, opinions when warranted, light humor when it lands.

---

# Voice Rules (hard bans)

- No em-dashes. Periods, commas, parentheses, or colons instead.
- No "not X, it's Y" reframes.
- No AI tell words: delve, tapestry, unleash, unlock, leverage, robust, journey, landscape, navigate, foster, harness, vibrant, dynamic, holistic, paradigm.
- No throat-clearing: "It's important to note that…", "It's worth mentioning…", "Of course!", "Certainly!", "Great question!"
- No sign-offs: "I hope this helps!", "Let me know if you need anything else!", "Happy to help!"
- No hedging stacks.
- No reflex tricolons unless each item earns its place.
- No generic openers: "In today's fast-paced world…", "In this article…", "Let's dive in…"
- No over-formatting. Earned structure beats reflex structure.

---

# Format Defaults

Match length and depth to the question. Healthy mix of prose, headers, and bullets. Markdown is supported, used deliberately.

---

# Vocabulary

Free-form sticky-note items are cards. Never say "sticky notes", "stickies", or "post-its".

---

# Link Integrity

Never invent, guess, or hallucinate URLs. Only cite links the user provided or content retrieved through the app.

---

# Board/Workspace Mutation Policy

Respond in chat. Don't create notes, documents, folders, or new items unless the user explicitly asks you to edit an existing item and you have the current body.

---

# Context Scope

You only know the context the user explicitly attaches (mentions, pasted text, uploaded content, or items included by the app). Don't claim awareness of unseen workspace items.

---

# Tool Routing

You can call tools the app exposes. Default to plain prose. Reach for a card tool only when it clearly helps, and never claim a tool you did not use. Keep tool outputs grounded in real context (mentions, attached items, retrieved data). Never invent post ids, handles, or metrics.

- getCreatorData: ALWAYS call this FIRST whenever the user asks about a specific creator by name or handle (analyze, summarize, breakdown, "stats for X", "show X's posts"). It returns that creator's real saved data: followers, posts indexed, total and average views, engagement rate, outlier mean and median, and top posts with ids. The result comes back to you only; the user does not see it. Use those exact numbers to fill the cards below. If the result has an error field, the creator is not saved, so tell the user that plainly and do not make up numbers.
- creatorSnapshot: after getCreatorData succeeds, render the creator's real metrics. Fill only fields you got back. Example: "give me a snapshot of @nathan" -> call getCreatorData, then creatorSnapshot.
- draftDocument: when the deliverable is a structured, keep-worthy document with sections or a table. Pick kind breakdown, analysis, plan, or other. Ground every number in getCreatorData output. Example: "break down why this creator works" -> getCreatorData, then draftDocument breakdown.
- showSocialPosts: when the user wants to see specific posts. Use the post ids returned by getCreatorData (topPosts) or ids from mentions. Never fabricate ids.
- showBoostVariations: when the user asks for multiple ready-to-publish takes on one idea or post. Example: "give me 4 hooks for this reel."

If a card does not fit, answer in prose.
`;

export async function buildSystemPrompt(chat: Chat): Promise<string> {
  const voice = chat.voice_id ? await loadVoice(chat.voice_id) : null;
  const voicePart = assembleVoiceSystemPrompt(voice);
  const contextPart = await buildContextSection(chat);
  return [BASE_SYSTEM_PROMPT, voicePart, contextPart]
    .filter(Boolean)
    .join("\n\n---\n\n");
}

async function buildContextSection(chat: Chat): Promise<string> {
  if (!chat.context_kind || !chat.context_id || chat.context_kind === "freeform") {
    return "";
  }
  const sb = getSupabase();

  if (chat.context_kind === "creator_post") {
    const { data } = await sb
      .from("creator_posts")
      .select("*, creator:creators(*)")
      .eq("id", chat.context_id)
      .maybeSingle();
    if (!data) return "";
    const p = data as Record<string, unknown> & {
      creator?: { handle?: string; display_name?: string; platform?: string };
    };
    const c = p.creator || {};
    return `# Context: a saved post you're working with
- Author: @${c.handle || "?"} (${c.platform || "?"})
- URL: ${p.url}
- Type: ${p.media_type || "?"}
- Caption: ${(p.title_or_caption as string)?.slice(0, 800) || "(none)"}
${p.vision_analysis_md ? `\n## Vision analysis\n${p.vision_analysis_md}` : ""}
${p.transcript ? `\n## Transcript\n${(p.transcript as string).slice(0, 4000)}` : ""}`;
  }

  if (chat.context_kind === "board") {
    const { data: board } = await sb
      .from("boards")
      .select("*")
      .eq("id", chat.context_id)
      .maybeSingle();
    if (!board) return "";
    const { data: items } = await sb
      .from("board_items")
      .select(
        `*,
         creator_post:creator_posts(url, title_or_caption, vision_analysis_md),
         card:cards(body_md),
         document:documents(title, body_md),
         file:files(original_name, kind)`
      )
      .eq("board_id", chat.context_id);
    const lines: string[] = [];
    const b = board as { name: string; description: string | null };
    lines.push(`# Context: board "${b.name}"`);
    if (b.description) lines.push(b.description);
    lines.push(`\n## Items on the board:`);
    for (const item of (items || []) as Array<Record<string, unknown>>) {
      const kind = item.kind as string;
      if (kind === "post" && item.creator_post) {
        const cp = item.creator_post as Record<string, unknown>;
        lines.push(`- POST: ${(cp.title_or_caption as string)?.slice(0, 200) || cp.url}`);
      } else if (kind === "card" && item.card) {
        const card = item.card as { body_md: string };
        lines.push(`- CARD: ${card.body_md?.slice(0, 200) || "(empty)"}`);
      } else if (kind === "document" && item.document) {
        const d = item.document as { title: string; body_md: string };
        lines.push(`- DOC: ${d.title}\n  ${d.body_md?.slice(0, 400) || "(empty)"}`);
      } else if (kind === "file" && item.file) {
        const f = item.file as { original_name: string; kind: string };
        lines.push(`- FILE: ${f.original_name} (${f.kind})`);
      }
    }
    return lines.join("\n");
  }

  if (chat.context_kind === "document") {
    const { data } = await sb
      .from("documents")
      .select("*")
      .eq("id", chat.context_id)
      .maybeSingle();
    if (!data) return "";
    const d = data as { title: string; body_md: string };
    return `# Context: document "${d.title}"\n\n${d.body_md}`;
  }

  if (chat.context_kind === "save") {
    const { data } = await sb
      .from("saves")
      .select("*, creator_post:creator_posts(*, creator:creators(*))")
      .eq("id", chat.context_id)
      .eq("workspace_id", chat.workspace_id)
      .maybeSingle();
    if (!data) return "";
    const s = data as Record<string, unknown>;
    const cp = (s.creator_post as Record<string, unknown>) || {};
    return `# Context: a saved post
- Caption: ${(s.caption as string)?.slice(0, 800) || ""}
- Notes: ${(s.notes_md as string)?.slice(0, 400) || ""}
${cp.vision_analysis_md ? `\n## Vision analysis\n${cp.vision_analysis_md}` : ""}`;
  }

  if (chat.context_kind === "idea") {
    const { data } = await sb
      .from("content_ideas")
      .select("*")
      .eq("id", chat.context_id)
      .eq("workspace_id", chat.workspace_id)
      .maybeSingle();
    if (!data) return "";
    const i = data as Record<string, unknown>;
    return `# Context: content idea "${i.name}"
- Angle: ${i.angle}
- Pillar: ${i.pillar}, Format: ${i.format}
- Hooks: ${i.hook_curiosity} | ${i.hook_value} | ${i.hook_emotional}
- Outline: ${i.outline_md}`;
  }

  if (chat.context_kind === "voice_build") {
    // The chat itself becomes the source material; no extra context.
    return `# Context: voice-building conversation
You are helping the user articulate their writing voice. Ask open questions, mirror their answers back in concrete terms, and steer toward specifics about audience, mission, point of view, vocabulary they prefer/avoid, and formatting habits. Stay conversational. Don't lecture. When you have enough, suggest they say "save my voice" to finalize.`;
  }

  return "";
}
