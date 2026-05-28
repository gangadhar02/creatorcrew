/**
 * Extracts a structured Voice from raw inputs (URLs to user's content, pasted
 * transcripts, or an archetype starting point). Uses Gemini's structured JSON
 * response. Returns a Voice-shaped object ready to insert into Supabase.
 */
import { GoogleGenAI, Type } from "@google/genai";
import type { Voice } from "./types";

const apiKey = process.env.GEMINI_API_KEY!;
const model = process.env.IDEATION_MODEL || "gemini-2.5-pro";

if (!apiKey) {
  console.warn("GEMINI_API_KEY missing — voice extraction will fail.");
}

const VOICE_SCHEMA = {
  type: Type.OBJECT,
  required: [
    "name",
    "mission_md",
    "audience_md",
    "pov_md",
    "core_ideas_md",
    "tone_md",
    "always_do_md",
    "avoid_md",
    "formatting_md",
  ],
  properties: {
    name: {
      type: Type.STRING,
      description:
        "A short, memorable name for this voice (3-6 words). Examples: 'The Sharp Generalist', 'The Cinematic Builder'. Don't include 'Voice' in the name.",
    },
    archetype: {
      type: Type.STRING,
      description:
        "Optional archetype label if one fits naturally (e.g. The Founder, The Operator, The Educator). Leave empty if none fits cleanly.",
    },
    mission_md: {
      type: Type.STRING,
      description: "1-2 sentence mission statement in markdown.",
    },
    audience_md: {
      type: Type.STRING,
      description: "Who this person creates for. Be specific.",
    },
    pov_md: {
      type: Type.STRING,
      description: "Their distinctive point of view. 1-3 sentences.",
    },
    core_ideas_md: {
      type: Type.STRING,
      description:
        "3-5 core ideas they return to. Markdown bullet list, one per line starting with '- '.",
    },
    vocabulary_preferred: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "5-12 words/phrases this voice leans on.",
    },
    vocabulary_avoid: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "5-12 words/phrases this voice avoids (cliches, generic AI-speak).",
    },
    tone_md: {
      type: Type.STRING,
      description: "1-2 sentences describing the tonal register.",
    },
    always_do_md: {
      type: Type.STRING,
      description: "Concrete moves this voice always makes. Bullet list.",
    },
    avoid_md: {
      type: Type.STRING,
      description: "Concrete moves this voice avoids. Bullet list.",
    },
    formatting_md: {
      type: Type.STRING,
      description:
        "Structural habits: hook style, paragraph length, list usage, CTA pattern, etc.",
    },
    writing_samples_md: {
      type: Type.STRING,
      description:
        "If sources were provided, 2-3 short excerpts (40-80 words each) that best exemplify the voice.",
    },
  },
};

type VoicePayload = {
  name: string;
  archetype?: string;
  mission_md: string;
  audience_md: string;
  pov_md: string;
  core_ideas_md: string;
  vocabulary_preferred?: string[];
  vocabulary_avoid?: string[];
  tone_md: string;
  always_do_md: string;
  avoid_md: string;
  formatting_md: string;
  writing_samples_md?: string;
};

export async function extractVoiceFromLinks(
  urls: string[]
): Promise<Partial<Voice>> {
  const ai = new GoogleGenAI({ apiKey });
  const fetched = await Promise.all(
    urls.slice(0, 5).map(async (url) => {
      try {
        const r = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36",
          },
        });
        if (!r.ok) return { url, content: `(failed to fetch: ${r.status})` };
        const html = await r.text();
        // Strip HTML tags and scripts to keep the prompt focused on text.
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .slice(0, 4000);
        return { url, content: text };
      } catch (e) {
        return { url, content: `(fetch error: ${e})` };
      }
    })
  );

  const prompt = `You are analyzing a creator's published content to extract their authentic writing voice. Build a precise voice profile they can use for AI-assisted drafts in their actual style.

Content sources:
${fetched.map((f, i) => `\n--- Source ${i + 1}: ${f.url} ---\n${f.content}`).join("\n")}

Extract a voice that captures THIS creator's distinctive register. Lift exact vocabulary they use. Capture their formatting habits (hook style, paragraph rhythm, CTA pattern). The output should feel unmistakably theirs, not a generic creator template.

Return the structured JSON.`;

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: VOICE_SCHEMA,
      temperature: 0.6,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned empty voice extraction");
  const parsed = JSON.parse(text) as VoicePayload;
  return payloadToVoice(parsed, urls);
}

export async function extractVoiceFromChat(
  conversation: { role: "user" | "assistant"; content: string }[]
): Promise<Partial<Voice>> {
  const ai = new GoogleGenAI({ apiKey });
  const transcript = conversation
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  const prompt = `The following is a guided voice-discovery conversation between a creator and an assistant. From this conversation, extract a structured voice profile that reflects what they actually said about how they think, write, and want to come across.

---
${transcript}
---

Lift their actual phrases where possible. Don't invent positions they didn't state. Where they were uncertain, write the field generously but mark uncertainty in tone (use "tends to" rather than "always"). Return the structured JSON.`;

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: VOICE_SCHEMA,
      temperature: 0.5,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned empty voice extraction");
  const parsed = JSON.parse(text) as VoicePayload;
  return payloadToVoice(parsed, []);
}

function payloadToVoice(
  p: VoicePayload,
  source_links: string[]
): Partial<Voice> {
  return {
    name: p.name,
    archetype: p.archetype || null,
    mission_md: p.mission_md,
    audience_md: p.audience_md,
    pov_md: p.pov_md,
    core_ideas_md: p.core_ideas_md,
    vocabulary: {
      preferred: p.vocabulary_preferred || [],
      avoid: p.vocabulary_avoid || [],
    },
    tone_md: p.tone_md,
    always_do_md: p.always_do_md,
    avoid_md: p.avoid_md,
    formatting_md: p.formatting_md,
    writing_samples_md: p.writing_samples_md || null,
    source_links: source_links,
  };
}
