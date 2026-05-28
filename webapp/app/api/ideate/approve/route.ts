/**
 * POST /api/ideate/approve
 * Body: { save_id: string, idea: IdeaProposal }
 *
 * Inserts a content_ideas row with this week's Monday as week_of, and marks
 * the source save's status as 'Used'.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import type { IdeaProposal } from "@/lib/ideate";

export const runtime = "nodejs";

function mondayOfThisWeek(): string {
  const d = new Date();
  // getDay(): Sun=0, Mon=1, ...
  const dow = d.getDay();
  const diff = (dow + 6) % 7; // days since most-recent Monday
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  const sb = getSupabase();
  const body = (await request.json()) as {
    save_id: string;
    idea: IdeaProposal;
    voice_id?: string | null;
  };
  if (!body.save_id || !body.idea) {
    return NextResponse.json({ error: "save_id and idea required" }, { status: 400 });
  }
  const i = body.idea;
  const row = {
    save_id: body.save_id,
    voice_id: body.voice_id || null,
    name: i.name,
    pillar: i.pillar,
    priority: i.priority,
    format: i.format,
    platforms: i.platforms,
    angle: i.angle,
    hook_curiosity: i.hook_curiosity,
    hook_value: i.hook_value,
    hook_emotional: i.hook_emotional,
    outline_md: i.outline_md,
    ig_breakdown_md: i.ig_breakdown_md ?? null,
    x_breakdown_md: i.x_breakdown_md ?? null,
    youtube_breakdown_md: i.youtube_breakdown_md ?? null,
    week_of: mondayOfThisWeek(),
    status: "Not started" as const,
  };
  const { data, error } = await sb
    .from("content_ideas")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await sb
    .from("saves")
    .update({ status: "Used" })
    .eq("id", body.save_id);
  return NextResponse.json({ ok: true, idea_id: (data as { id: string }).id });
}
