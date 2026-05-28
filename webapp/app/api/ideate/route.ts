/**
 * POST /api/ideate
 * Body: { save_ids?: string[] }   // optional — defaults to all Status=New
 *
 * Streams nothing; returns the full array of generated proposals at once.
 * For each save, generates a structured idea via Gemini and includes the
 * save_id + a transient client_idea_id so the UI can track approval state.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { ideateSave, type IdeaProposal } from "@/lib/ideate";
import type { Save } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const sb = getSupabase();
  let bodyJson: { save_ids?: string[]; voice_id?: string | null } = {};
  try {
    bodyJson = await request.json();
  } catch {
    /* empty body is fine */
  }

  let q = sb
    .from("saves")
    .select("*")
    .order("saved_at", { ascending: true });
  if (bodyJson.save_ids && bodyJson.save_ids.length > 0) {
    q = q.in("id", bodyJson.save_ids);
  } else {
    q = q.eq("status", "New");
  }
  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const saves = (data || []) as Save[];

  const results: {
    save: Pick<Save, "id" | "author" | "type" | "url" | "collection_name">;
    proposal: IdeaProposal | null;
    error?: string;
  }[] = [];

  for (const save of saves) {
    try {
      const proposal = await ideateSave(save, bodyJson.voice_id);
      results.push({
        save: {
          id: save.id,
          author: save.author,
          type: save.type,
          url: save.url,
          collection_name: save.collection_name,
        },
        proposal,
      });
    } catch (e) {
      results.push({
        save: {
          id: save.id,
          author: save.author,
          type: save.type,
          url: save.url,
          collection_name: save.collection_name,
        },
        proposal: null,
        error: String(e),
      });
    }
  }

  return NextResponse.json({ count: results.length, results });
}
