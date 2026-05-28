/**
 * Assembles a Gemini system prompt from a Voice row.
 * Every AI generation site (ideate, boost, chat, document drafts) should
 * route through this so the user's voice is honored end-to-end.
 */
import { getSupabase } from "./supabase";
import type { Voice } from "./types";

export async function loadVoice(voiceId: string | null): Promise<Voice | null> {
  if (!voiceId) return null;
  const sb = getSupabase();
  const { data } = await sb
    .from("voices")
    .select("*")
    .eq("id", voiceId)
    .maybeSingle();
  return data as Voice | null;
}

export async function loadDefaultVoice(
  workspaceId: string
): Promise<Voice | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("voices")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();
  return data as Voice | null;
}

export function assembleVoiceSystemPrompt(voice: Voice | null): string {
  if (!voice) return "";
  const parts: string[] = [];
  parts.push(
    `# Your voice: ${voice.name}${voice.archetype ? ` (${voice.archetype})` : ""}`
  );
  parts.push(
    "Honor this voice in everything you produce. The voice is more important than any individual rule."
  );

  if (voice.mission_md) parts.push("\n## Mission\n" + voice.mission_md);
  if (voice.audience_md) parts.push("\n## Audience\n" + voice.audience_md);
  if (voice.pov_md) parts.push("\n## Point of view\n" + voice.pov_md);
  if (voice.core_ideas_md) parts.push("\n## Core ideas\n" + voice.core_ideas_md);
  if (voice.tone_md) parts.push("\n## Tone\n" + voice.tone_md);
  if (voice.always_do_md) parts.push("\n## Always do\n" + voice.always_do_md);
  if (voice.avoid_md) parts.push("\n## Avoid\n" + voice.avoid_md);
  if (voice.formatting_md) parts.push("\n## Formatting\n" + voice.formatting_md);

  const vocab = voice.vocabulary || {};
  const preferred = (vocab as { preferred?: string[] }).preferred || [];
  const avoid = (vocab as { avoid?: string[] }).avoid || [];
  if (preferred.length || avoid.length) {
    parts.push("\n## Vocabulary");
    if (preferred.length)
      parts.push(`- Lean on: ${preferred.map((w) => `"${w}"`).join(", ")}`);
    if (avoid.length)
      parts.push(`- Avoid: ${avoid.map((w) => `"${w}"`).join(", ")}`);
  }

  if (voice.writing_samples_md) {
    parts.push("\n## Writing samples (match the cadence and rhythm)\n" + voice.writing_samples_md);
  }

  // Structured carry-forward fields (migration 014)
  const v = voice as unknown as VoiceCard;
  if (v.anchor_stories?.length) {
    parts.push("\n## Anchor stories (return to these)");
    for (const s of v.anchor_stories) parts.push(`- ${s}`);
  }
  if (v.format_scaffolds?.length) {
    parts.push("\n## Format scaffolds");
    for (const s of v.format_scaffolds) parts.push(`- ${s}`);
  }
  if (v.tone_tags?.length) parts.push(`\nTone tags: ${v.tone_tags.join(", ")}`);
  if (v.rhythm) parts.push(`\nRhythm: ${v.rhythm}`);
  if (v.prefer?.length) parts.push(`\nPrefer: ${v.prefer.join(", ")}`);
  if (v.avoid?.length) parts.push(`\nAvoid: ${v.avoid.join(", ")}`);
  if (v.vocabulary_list?.length) {
    parts.push("\n## Distinctive vocabulary");
    parts.push(v.vocabulary_list.map((w) => `"${w}"`).join(", "));
  }
  if (v.writing_samples?.length) {
    parts.push("\n## Writing samples (verbatim)");
    for (const s of v.writing_samples) parts.push(`\n>${s.replace(/\n/g, "\n>")}`);
  }

  return parts.join("\n");
}

// ============================================================================
// Voice card v0/v1 carry-forward (migration 014)
// ============================================================================

export type VoiceCard = Voice & {
  version?: string;
  history?: { snapshot: Record<string, unknown>; version: string; ts: number }[];
  vocabulary_list?: string[];
  writing_samples?: string[];
  anchor_stories?: string[];
  format_scaffolds?: string[];
  tone_tags?: string[];
  rhythm?: string;
  format_habits?: string;
  prefer?: string[];
  avoid?: string[];
};

function bumpVersion(v: string | undefined | null): string {
  if (!v) return "v0";
  const m = v.match(/^v(\d+)(?:\.(\d+))?$/);
  if (!m) return "v1";
  const major = Number(m[1]);
  const minor = m[2] ? Number(m[2]) : 0;
  // First save is v0 → v1; subsequent saves bump minor.
  if (v === "v0") return "v1";
  return `v${major}.${minor + 1}`;
}

/**
 * Carry-forward save: only-overrides-on-set merge. Fields the caller does not
 * provide are preserved verbatim. Each save pushes the previous snapshot into
 * history (capped at 20).
 */
export async function saveVoiceWithCarryForward(
  voiceId: string,
  partial: Partial<VoiceCard>,
  opts: { setVersion?: "v0" } = {}
): Promise<VoiceCard | null> {
  const sb = getSupabase();
  const { data: prevRow } = await sb
    .from("voices")
    .select("*")
    .eq("id", voiceId)
    .maybeSingle();
  if (!prevRow) return null;
  const prev = prevRow as VoiceCard;

  // Merge: only overwrite when caller supplied a non-undefined value.
  const merged: Partial<VoiceCard> = {};
  for (const [k, v] of Object.entries(partial)) {
    if (v !== undefined) (merged as Record<string, unknown>)[k] = v;
  }

  const newVersion = opts.setVersion || bumpVersion(prev.version);
  const newHistory = [
    ...((prev.history || []) as VoiceCard["history"] extends infer T
      ? T extends Array<infer X>
        ? X[]
        : never
      : never),
    {
      snapshot: prev as unknown as Record<string, unknown>,
      version: prev.version || "v0",
      ts: Date.now(),
    },
  ].slice(-20);

  const next = { ...merged, version: newVersion, history: newHistory };
  const { data: updated, error } = await sb
    .from("voices")
    .update(next)
    .eq("id", voiceId)
    .select("*")
    .single();
  if (error) return null;
  return updated as VoiceCard;
}
