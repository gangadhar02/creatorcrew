/**
 * Server-side ideation: given a save (with vision analysis), call Gemini to
 * produce a structured content idea targeted at AI Creatives / AI Filmmaking /
 * AI Ads / AI Video & Image. Returns a JSON object that matches the
 * content_ideas schema.
 */
import { GoogleGenAI, Type } from "@google/genai";
import type { Save, Voice } from "./types";
import { assembleVoiceSystemPrompt, loadVoice } from "./voice";

const apiKey = process.env.GEMINI_API_KEY!;
const model = process.env.IDEATION_MODEL || "gemini-2.5-pro";

if (!apiKey) {
  // Logged at first use to avoid breaking the build.
  console.warn("GEMINI_API_KEY missing — ideation will fail.");
}

export type IdeaProposal = {
  skip: boolean;
  skip_reason?: string;
  name: string;
  pillar: "Teach" | "Showcase" | "Tools" | "Process" | "Trends";
  priority: "High" | "Medium" | "Low";
  format: "Carousel" | "Reel" | "Short Video" | "Long-form Video";
  platforms: ("Instagram" | "X" | "YouTube")[];
  angle: string;
  hook_curiosity: string;
  hook_value: string;
  hook_emotional: string;
  outline_md: string;
  ig_breakdown_md?: string | null;
  x_breakdown_md?: string | null;
  youtube_breakdown_md?: string | null;
};

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: [
    "skip",
    "name",
    "pillar",
    "priority",
    "format",
    "platforms",
    "angle",
    "hook_curiosity",
    "hook_value",
    "hook_emotional",
    "outline_md",
  ],
  properties: {
    skip: {
      type: Type.BOOLEAN,
      description:
        "Set true ONLY if this post lacks enough material (e.g., opaque meme, generic motivational, no transferable technique) to produce a useful idea for the AI Creatives audience.",
    },
    skip_reason: {
      type: Type.STRING,
      description: "Reason if skip=true; empty otherwise.",
    },
    name: {
      type: Type.STRING,
      description: "Title of the idea — punchy, hook-shaped, 6-14 words.",
    },
    pillar: {
      type: Type.STRING,
      enum: ["Teach", "Showcase", "Tools", "Process", "Trends"],
    },
    priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
    format: {
      type: Type.STRING,
      enum: ["Carousel", "Reel", "Short Video", "Long-form Video"],
    },
    platforms: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: ["Instagram", "X", "YouTube"] },
      description:
        "Subset of platforms this idea is worth executing on. Include YouTube ONLY if there's enough depth for 5+ min long-form.",
    },
    angle: {
      type: Type.STRING,
      description:
        "1-2 sentences describing the reframe — what's the angle for the AI Creatives audience?",
    },
    hook_curiosity: { type: Type.STRING, description: "Open-loop hook." },
    hook_value: { type: Type.STRING, description: "Concrete-promise hook." },
    hook_emotional: { type: Type.STRING, description: "Stakes/identity hook." },
    outline_md: {
      type: Type.STRING,
      description:
        "Markdown outline: HOOK → 3-4 KEY POINTS → CTA. Use bulleted lines.",
    },
    ig_breakdown_md: {
      type: Type.STRING,
      description:
        "Markdown notes for the Instagram execution (Carousel slides or Reel shot list). Empty string if Instagram not in platforms.",
    },
    x_breakdown_md: {
      type: Type.STRING,
      description:
        "Markdown for X/Twitter thread breakdown. Empty string if X not in platforms.",
    },
    youtube_breakdown_md: {
      type: Type.STRING,
      description:
        "Markdown for YouTube long-form. Empty string if YouTube not in platforms.",
    },
  },
};

function buildPrompt(save: Save, voice: Voice | null): string {
  const audienceLine = voice?.audience_md
    ? voice.audience_md.split("\n")[0]
    : "AI Creatives, AI Filmmaking, AI Ads, AI Video & Image producers";
  return `You are generating one content idea for a creator whose audience is **${audienceLine}**.

Pillars to pick from: Teach, Showcase, Tools, Process, Trends.
Platforms: Instagram, X (Twitter), YouTube.

## Source post

- Author: @${save.author || "unknown"}
- Type: ${save.type}
- Collection: ${save.collection_name || "(none)"}
- IG URL: ${save.url}
- Caption: ${(save.caption || "").slice(0, 500) || "(none)"}

## Vision analysis of the actual media

This is the PRIMARY input — a detailed deconstruction of what's on screen. Lean on this. Caption is secondary.

${save.vision_analysis_md || "(no vision analysis available — proceed from caption only)"}

## Your task

Produce ONE idea object in JSON matching the schema. Lift the actual *technique* visible in the post — don't just rephrase the caption. Tool callouts should match the "Tools / Workflow Signals" section of the vision analysis when present.

If the post genuinely has nothing transferable (opaque meme, generic motivation, tangential to AI creative work), set skip=true with a short reason — don't manufacture an idea.`;
}

export async function ideateSave(
  save: Save,
  voiceId?: string | null
): Promise<IdeaProposal> {
  const ai = new GoogleGenAI({ apiKey });
  const voice = voiceId ? await loadVoice(voiceId) : null;
  const voicePrompt = assembleVoiceSystemPrompt(voice);
  const prompt = voicePrompt
    ? `${voicePrompt}\n\n---\n\n${buildPrompt(save, voice)}`
    : buildPrompt(save, voice);
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.7,
    },
  });
  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned empty response");
  }
  const parsed = JSON.parse(text) as IdeaProposal;
  // Normalize empty-string breakdowns to null for cleaner storage
  if (!parsed.ig_breakdown_md) parsed.ig_breakdown_md = null;
  if (!parsed.x_breakdown_md) parsed.x_breakdown_md = null;
  if (!parsed.youtube_breakdown_md) parsed.youtube_breakdown_md = null;
  return parsed;
}
