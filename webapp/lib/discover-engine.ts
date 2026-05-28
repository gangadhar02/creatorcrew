/**
 * Hybrid Discover engine — keyword (tsvector) + vector (pgvector) over
 * creator_posts. Two-stage relaxation (strict → outlier-gte-5) mirrors Eden's
 * default behavior. Returns `feedDiagnostics` so the UI can show which path
 * served the result.
 */
import { GoogleGenAI } from "@google/genai";
import { getSupabase } from "./supabase";
import type { PostWithCreator } from "./discover-types";
import { buildProfileVector, personalizationDiagnostics } from "./personalization";

const apiKey = process.env.GEMINI_API_KEY!;
const EMBED_MODEL = process.env.EMBED_MODEL || "gemini-embedding-001";

export type DiscoverQuery = {
  q?: string;
  platforms?: string[];
  pillarTaxonomyIds?: string[];
  minOutlier?: number;
  since?: string;
  listId?: string;
  workspaceId: string;
  limit?: number;
};

export type FeedDiagnostics = {
  searchPath:
    | "sql-strict"
    | "sql-relaxed"
    | "hybrid-strict"
    | "hybrid-relaxed";
  poolSize: number;
  relaxation?: { applied: boolean; reason: string };
  personalization?: {
    enabled: boolean;
    eligible: boolean;
    reason: string;
    signalWeight: number;
    profileVectorDims: number;
    annPoolSize: number;
    annPoolMerged: number;
    threshold: number;
  };
};

export type DiscoverResult = {
  content: PostWithCreator[];
  feedDiagnostics: FeedDiagnostics;
};

const POST_COLUMNS = `id, platform, platform_pk, code, url, media_type, title_or_caption,
   like_count, comment_count, view_count, play_count, engagement_rate,
   outlier_multiplier, published_at, thumbnail_url, transcript,
   vision_analysis_md, pillar_id, taxonomy_id, taxonomy_label, taxonomy_tier1,
   content_type_label, media_format, mood, ai_tags, ai_description,
   ai_overview, enriched_at,
   creator:creators!inner(id, handle, display_name, follower_count, avatar_url,
     is_verified, platform, workspace_id)`;

export async function discover({
  q,
  platforms,
  pillarTaxonomyIds,
  minOutlier = 0,
  since,
  workspaceId,
  limit = 80,
}: DiscoverQuery): Promise<DiscoverResult> {
  const sb = getSupabase();
  const hasQuery = !!q?.trim();

  // Embedding for vector search (only when there's a query string).
  let embedding: number[] | null = null;
  if (hasQuery && apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const r = await ai.models.embedContent({
        model: EMBED_MODEL,
        contents: q!,
      });
      const v = r.embeddings?.[0]?.values;
      if (v && v.length > 0) embedding = v;
    } catch (e) {
      console.warn("[discover] embed failed:", e);
    }
  }

  async function runQuery(opts: {
    minOutlier: number;
    pillars?: string[];
  }): Promise<PostWithCreator[]> {
    let qb = sb
      .from("creator_posts")
      .select(POST_COLUMNS)
      .eq("creators.workspace_id", workspaceId);
    if (platforms && platforms.length > 0) qb = qb.in("platform", platforms);
    if (opts.pillars && opts.pillars.length > 0) {
      qb = qb.in("taxonomy_id", opts.pillars);
    }
    if (opts.minOutlier > 0)
      qb = qb.gte("outlier_multiplier", opts.minOutlier);
    if (since) qb = qb.gte("published_at", since);
    if (hasQuery) {
      // tsvector match — wrap user query as websearch-style.
      qb = qb.textSearch("fts", q!, {
        type: "websearch",
        config: "simple",
      });
    }
    qb = qb
      .order("outlier_multiplier", { ascending: false, nullsFirst: false })
      .limit(limit);
    const { data } = await qb;
    return (data || []) as unknown as PostWithCreator[];
  }

  // Strict pass
  let posts = await runQuery({ minOutlier, pillars: pillarTaxonomyIds });
  let relaxation: FeedDiagnostics["relaxation"] = { applied: false, reason: "" };

  // When full-text search returns few hits, broaden with caption/description ilike.
  if (hasQuery && posts.length < Math.min(limit, 24)) {
    const pattern = `%${q!.replace(/%/g, "\\%")}%`;
    let qb = sb
      .from("creator_posts")
      .select(POST_COLUMNS)
      .eq("creators.workspace_id", workspaceId)
      .or(
        `title_or_caption.ilike.${pattern},ai_description.ilike.${pattern}`
      );
    if (platforms && platforms.length > 0) qb = qb.in("platform", platforms);
    if (since) qb = qb.gte("published_at", since);
    qb = qb
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    const { data: ilikeRows } = await qb;
    const merged = new Map<string, PostWithCreator>();
    for (const p of posts) merged.set(p.id, p);
    for (const p of (ilikeRows || []) as unknown as PostWithCreator[]) {
      if (!merged.has(p.id)) merged.set(p.id, p);
    }
    posts = Array.from(merged.values());
  }

  if (posts.length < 12 && minOutlier > 5) {
    // Relax outlier threshold to 5×
    posts = await runQuery({ minOutlier: 5, pillars: pillarTaxonomyIds });
    relaxation = { applied: true, reason: "outlier-gte-5" };
  }

  // Vector ANN merge — only when we have embedding + headroom.
  let annPoolMerged = 0;
  if (embedding) {
    try {
      const { data: ann } = await sb.rpc("match_creator_posts", {
        query_embedding: embedding,
        match_count: Math.min(limit, 50),
        ws: workspaceId,
      });
      const merged = new Map<string, PostWithCreator>();
      for (const p of posts) merged.set(p.id, p);
      for (const a of (ann || []) as PostWithCreator[]) {
        if (!merged.has(a.id)) {
          merged.set(a.id, a);
          annPoolMerged += 1;
        }
      }
      posts = Array.from(merged.values());
    } catch {
      // RPC missing — fall back to tsvector-only results
    }
  }

  // Personalization ANN-merge based on the workspace profile vector. Only
  // kicks in once the user has ≥ 8 signals (matches Eden's threshold).
  const persDiag = await personalizationDiagnostics(workspaceId);
  if (persDiag.eligible) {
    try {
      const { vector } = await buildProfileVector(workspaceId);
      if (vector) {
        const { data: ann } = await sb.rpc("match_creator_posts", {
          query_embedding: vector,
          match_count: 50,
          ws: workspaceId,
        });
        const merged = new Map<string, PostWithCreator>();
        for (const p of posts) merged.set(p.id, p);
        for (const a of (ann || []) as PostWithCreator[]) {
          if (!merged.has(a.id)) {
            merged.set(a.id, a);
            persDiag.annPoolMerged += 1;
          }
        }
        posts = Array.from(merged.values());
      }
    } catch {
      /* RPC missing */
    }
  }

  return {
    content: posts.slice(0, limit),
    feedDiagnostics: {
      searchPath: embedding
        ? relaxation.applied
          ? "hybrid-relaxed"
          : "hybrid-strict"
        : relaxation.applied
          ? "sql-relaxed"
          : "sql-strict",
      poolSize: posts.length,
      relaxation,
      personalization: persDiag,
    },
  };
}
