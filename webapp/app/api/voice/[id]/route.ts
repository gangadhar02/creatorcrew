/**
 * GET /api/voice/[id]   — fetch one voice
 * PATCH /api/voice/[id] — update fields (any subset)
 * DELETE /api/voice/[id] — delete (archetype rows are protected)
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

const ALLOWED_KEYS = new Set([
  "name",
  "archetype",
  "mission_md",
  "audience_md",
  "pov_md",
  "core_ideas_md",
  "vocabulary",
  "tone_md",
  "always_do_md",
  "avoid_md",
  "formatting_md",
  "writing_samples_md",
  "source_links",
  "is_default",
]);

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const sb = getSupabase();
  const { data, error } = await sb
    .from("voices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "not found" },
      { status: 404 }
    );
  }
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json()) as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_KEYS.has(k)) update[k] = v;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no allowed fields" }, { status: 400 });
  }
  const sb = getSupabase();

  // If setting this voice as default, unset any other defaults in the same workspace.
  if (update.is_default === true) {
    const { data: v } = await sb
      .from("voices")
      .select("workspace_id")
      .eq("id", id)
      .maybeSingle();
    const wsId = (v as { workspace_id: string | null } | null)?.workspace_id;
    if (wsId) {
      await sb
        .from("voices")
        .update({ is_default: false })
        .eq("workspace_id", wsId)
        .eq("is_default", true);
    }
  }

  const { error } = await sb.from("voices").update(update).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const sb = getSupabase();
  // Refuse to delete archetypes (global rows).
  const { data: v } = await sb
    .from("voices")
    .select("is_archetype")
    .eq("id", id)
    .maybeSingle();
  if ((v as { is_archetype: boolean } | null)?.is_archetype) {
    return NextResponse.json(
      { error: "cannot delete archetype" },
      { status: 400 }
    );
  }
  const { error } = await sb.from("voices").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
