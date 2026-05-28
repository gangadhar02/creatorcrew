/**
 * POST /api/events/content
 * Body: { events: [{ content_id, event_type, dwell_ms?, position?, surface?,
 *                    view_mode?, tab?, session_id?, occurred_at?, metadata? }] }
 *
 * Accepts a batch of interaction events. The client buffers and flushes
 * every ~5 seconds or on visibility change.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

type InEvent = {
  content_id: string;
  event_type: "view" | "dwell" | "impression" | "click" | "save" | "boost";
  dwell_ms?: number;
  position?: number;
  surface?: string;
  view_mode?: string;
  tab?: string;
  session_id?: string;
  occurred_at?: number;
  metadata?: Record<string, unknown>;
  creator_id?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { events: InEvent[] };
  if (!Array.isArray(body.events) || body.events.length === 0) {
    return NextResponse.json({ inserted: 0 });
  }
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) return NextResponse.json({ inserted: 0 });

  const rows = body.events
    .filter((e) => e.content_id && e.event_type)
    .map((e) => ({
      workspace_id: ws.workspaceId,
      content_id: e.content_id,
      creator_id: e.creator_id || null,
      session_id: e.session_id || null,
      event_type: e.event_type,
      dwell_ms: e.dwell_ms ?? null,
      position: e.position ?? null,
      surface: e.surface || null,
      view_mode: e.view_mode || null,
      tab: e.tab || null,
      metadata: e.metadata || null,
      occurred_at: e.occurred_at ?? Date.now(),
    }));

  if (rows.length === 0) return NextResponse.json({ inserted: 0 });

  const sb = getSupabase();
  const { error } = await sb.from("post_events").insert(rows);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inserted: rows.length });
}
