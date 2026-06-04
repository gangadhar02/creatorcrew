/**
 * Insert a new workspace voice from an extracted payload and mark the
 * build_voice onboarding task complete. Shared by /api/voice/extract and
 * /api/voice/save-from-chat so the row shape stays in one place.
 *
 * Server-only.
 */
import { getSupabase } from "./supabase";
import type { Voice } from "./types";

export async function createVoiceRow(
  workspaceId: string,
  payload: Partial<Voice>
): Promise<string> {
  const sb = getSupabase();

  const row = {
    workspace_id: workspaceId,
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
    throw new Error(error?.message || "voice insert failed");
  }

  // Auto-mark onboarding 'build_voice' complete (best-effort).
  await sb
    .from("onboarding_progress")
    .upsert(
      {
        workspace_id: workspaceId,
        task_key: "build_voice",
        completed_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,task_key" }
    );

  return (data as { id: string }).id;
}
