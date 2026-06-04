/**
 * POST /api/voice/[id]/refine
 * Body: { instruction: string }
 *
 * Accepts a natural-language refinement ("shorter sentences, drop the corporate
 * vocabulary, use more contrarian framing"), re-runs Gemini against the
 * existing voice + instruction, writes the diff back.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import { GoogleGenAI, Type } from "@google/genai";
import type { Voice } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const REFINE_SCHEMA = {
  type: Type.OBJECT,
  required: ["fields"],
  properties: {
    fields: {
      type: Type.OBJECT,
      description: "Only include the fields you want to change. Omit unchanged ones.",
      properties: {
        name: { type: Type.STRING },
        archetype: { type: Type.STRING },
        mission_md: { type: Type.STRING },
        audience_md: { type: Type.STRING },
        pov_md: { type: Type.STRING },
        core_ideas_md: { type: Type.STRING },
        vocabulary_preferred: { type: Type.ARRAY, items: { type: Type.STRING } },
        vocabulary_avoid: { type: Type.ARRAY, items: { type: Type.STRING } },
        tone_md: { type: Type.STRING },
        always_do_md: { type: Type.STRING },
        avoid_md: { type: Type.STRING },
        formatting_md: { type: Type.STRING },
        writing_samples_md: { type: Type.STRING },
      },
    },
    summary: {
      type: Type.STRING,
      description: "One-sentence human-readable summary of what changed.",
    },
  },
};

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const { instruction } = (await request.json()) as { instruction: string };
  if (!instruction || !instruction.trim()) {
    return NextResponse.json({ error: "instruction required" }, { status: 400 });
  }
  const sb = getSupabase();
  const { data } = await sb
    .from("voices")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ws.workspaceId)
    .maybeSingle();
  const voice = data as Voice | null;
  if (!voice) {
    return NextResponse.json({ error: "voice not found" }, { status: 404 });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const prompt = `You are refining an existing voice profile per a user's instruction. Only modify the fields that need to change to satisfy the instruction. Leave the rest as-is.

# Current voice
Name: ${voice.name}
Archetype: ${voice.archetype || "—"}

## Mission
${voice.mission_md || "—"}

## Audience
${voice.audience_md || "—"}

## Point of view
${voice.pov_md || "—"}

## Core ideas
${voice.core_ideas_md || "—"}

## Tone
${voice.tone_md || "—"}

## Always do
${voice.always_do_md || "—"}

## Avoid
${voice.avoid_md || "—"}

## Formatting
${voice.formatting_md || "—"}

## Vocabulary
Preferred: ${JSON.stringify((voice.vocabulary as { preferred?: string[] })?.preferred || [])}
Avoid: ${JSON.stringify((voice.vocabulary as { avoid?: string[] })?.avoid || [])}

# Instruction
${instruction}

Return only the fields you changed.`;

  const response = await ai.models.generateContent({
    model: process.env.IDEATION_MODEL || "gemini-2.5-pro",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: REFINE_SCHEMA,
      temperature: 0.4,
    },
  });

  const text = response.text;
  if (!text) {
    return NextResponse.json({ error: "empty response" }, { status: 500 });
  }
  const parsed = JSON.parse(text) as {
    fields: Record<string, unknown>;
    summary?: string;
  };

  const update: Record<string, unknown> = {};
  const f = parsed.fields || {};
  const KEYS = [
    "name",
    "archetype",
    "mission_md",
    "audience_md",
    "pov_md",
    "core_ideas_md",
    "tone_md",
    "always_do_md",
    "avoid_md",
    "formatting_md",
    "writing_samples_md",
  ];
  for (const k of KEYS) {
    if (typeof f[k] === "string" && (f[k] as string).length > 0) {
      update[k] = f[k];
    }
  }
  if (Array.isArray(f.vocabulary_preferred) || Array.isArray(f.vocabulary_avoid)) {
    const existing = (voice.vocabulary as { preferred?: string[]; avoid?: string[] }) || {};
    update.vocabulary = {
      preferred: f.vocabulary_preferred || existing.preferred || [],
      avoid: f.vocabulary_avoid || existing.avoid || [],
    };
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({
      ok: true,
      changed_fields: [],
      summary: parsed.summary || "No changes applied.",
    });
  }

  const { error } = await sb
    .from("voices")
    .update(update)
    .eq("id", id)
    .eq("workspace_id", ws.workspaceId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    changed_fields: Object.keys(update),
    summary: parsed.summary || "Voice refined.",
  });
}
