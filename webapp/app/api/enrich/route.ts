/**
 * POST /api/enrich          — batch-enrich pending posts (limit/concurrency in body)
 * POST /api/enrich?id=<uuid> — enrich a single post by id (?force=1 to redo)
 *
 * Returns:
 *   { single: EnrichmentResult } | { enriched, attempted, failed }
 */
import { NextResponse, type NextRequest } from "next/server";
import { enrichAllPending, enrichPost } from "@/lib/enrich";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const force = request.nextUrl.searchParams.get("force") === "1";

  if (id) {
    const result = await enrichPost(id, { force });
    if (!result)
      return NextResponse.json(
        { error: "enrichment failed or post not found" },
        { status: 500 }
      );
    return NextResponse.json({ single: result });
  }

  const body = await request.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit) || 50, 200);
  const concurrency = Math.min(Number(body.concurrency) || 4, 8);
  const result = await enrichAllPending(limit, concurrency);
  return NextResponse.json(result);
}
