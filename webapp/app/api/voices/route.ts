/**
 * GET /api/voices
 * Returns: { workspace: Voice[], archetypes: Voice[] }
 *
 * Used by the voice library and the modal.
 */
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ws = await getWorkspaceContext();
  const sb = getSupabase();

  const [wsRes, archRes] = await Promise.all([
    ws.workspaceId
      ? sb
          .from("voices")
          .select("*")
          .eq("workspace_id", ws.workspaceId)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    sb
      .from("voices")
      .select("*")
      .eq("is_archetype", true)
      .order("name", { ascending: true }),
  ]);

  return NextResponse.json({
    workspace: wsRes.data || [],
    archetypes: archRes.data || [],
  });
}
