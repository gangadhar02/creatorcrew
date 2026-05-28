/**
 * Outlier-baseline computation. Mirrors Eden's per-(creator, segment, metric)
 * Pareto-tail fit:
 *
 *   1. Pull the last N posts (default 30) for a creator/segment ordered by
 *      published_at DESC.
 *   2. Sort by metric ASC. The median = the 50th-percentile value.
 *   3. mInfinity = mean of the top (1-tau)·N posts. This is a coarse
 *      location estimator for the tail — works without explicit GPD fitting
 *      at our scale.
 *   4. Outlier score for any new post:
 *        score = (metric - median) / (mInfinity - median)
 *      Score >= 1 means the post is performing at or above the typical
 *      outlier line for that creator/segment.
 *
 * Per-platform tau constants come from Eden's bundle. IG short-form is the
 * tightest tail (top 25%); Twitter is looser (top ~42%).
 */
import { getSupabase } from "./supabase";

export type SegmentId = "reel" | "post" | "video" | "short" | "default";

const TAU_BY_PLATFORM_SEGMENT: Record<string, Record<string, number>> = {
  instagram: { reel: 0.25, post: 0.25, default: 0.25 },
  twitter: { default: 0.4167 },
  x: { default: 0.4167 },
  youtube: { video: 0.3, short: 0.25, default: 0.3 },
  linkedin: { default: 0.4 },
  substack: { default: 0.5 },
  tiktok: { default: 0.25 },
};

export type OutlierBaseline = {
  creator_id: string;
  segment_id: string;
  metric_label: "views" | "likes";
  tau: number;
  median: number;
  m_infinity: number;
  sample_size: number;
  computed_at: string;
};

function tauFor(platform: string, segment: SegmentId): number {
  const t = TAU_BY_PLATFORM_SEGMENT[platform];
  if (!t) return 0.25;
  return t[segment] ?? t.default ?? 0.25;
}

function segmentForPost(p: {
  platform: string;
  media_type: string | null;
  media_format: string | null;
}): SegmentId {
  const fmt = (p.media_format || p.media_type || "").toLowerCase();
  if (p.platform === "instagram") {
    if (fmt === "video" || fmt === "reel" || fmt === "short_video") return "reel";
    return "post";
  }
  if (p.platform === "youtube") {
    if (fmt === "short" || fmt === "short_video") return "short";
    return "video";
  }
  return "default";
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[m - 1] + sorted[m]) / 2
    : sorted[m];
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

/** Compute baselines for one creator across all relevant segments/metrics. */
export async function computeBaselinesForCreator(
  creatorId: string,
  sampleSize = 30
): Promise<OutlierBaseline[]> {
  const sb = getSupabase();
  const { data: posts } = await sb
    .from("creator_posts")
    .select("platform, media_type, media_format, view_count, like_count, published_at")
    .eq("creator_id", creatorId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(sampleSize);
  const rows = (posts || []) as {
    platform: string;
    media_type: string | null;
    media_format: string | null;
    view_count: number;
    like_count: number;
    published_at: string | null;
  }[];
  if (rows.length === 0) return [];

  // Bucket by segment
  const bySegment: Record<SegmentId, typeof rows> = {
    reel: [],
    post: [],
    video: [],
    short: [],
    default: [],
  };
  for (const r of rows) {
    const seg = segmentForPost(r);
    bySegment[seg].push(r);
  }

  const baselines: OutlierBaseline[] = [];
  for (const seg of Object.keys(bySegment) as SegmentId[]) {
    const segRows = bySegment[seg];
    if (segRows.length === 0) continue;
    const platform = segRows[0].platform;
    const tau = tauFor(platform, seg);
    const sampleCount = segRows.length;

    for (const metric of ["views", "likes"] as const) {
      const values = segRows
        .map((r) => (metric === "views" ? r.view_count : r.like_count))
        .filter((v): v is number => typeof v === "number" && v > 0);
      if (values.length === 0) continue;
      const m = median(values);
      const sorted = [...values].sort((a, b) => a - b);
      const tailStart = Math.max(0, Math.floor(sorted.length * (1 - tau)));
      const tailValues = sorted.slice(tailStart);
      const mInf = mean(tailValues);
      baselines.push({
        creator_id: creatorId,
        segment_id: seg,
        metric_label: metric,
        tau,
        median: m,
        m_infinity: Math.max(mInf, m + 1),
        sample_size: sampleCount,
        computed_at: new Date().toISOString(),
      });
    }
  }

  // Persist (idempotent upsert).
  if (baselines.length > 0) {
    await sb
      .from("outlier_baselines")
      .upsert(baselines, {
        onConflict: "creator_id,segment_id,metric_label",
      });
  }
  return baselines;
}

/**
 * Score a post given precomputed baselines:
 *   score = (metric - median) / (mInfinity - median)
 * Returns null if no baseline matches.
 */
export function scorePost(
  baseline: OutlierBaseline,
  value: number
): number | null {
  if (!baseline) return null;
  if (baseline.m_infinity <= baseline.median) return null;
  const score = (value - baseline.median) / (baseline.m_infinity - baseline.median);
  return Number.isFinite(score) ? score : null;
}
