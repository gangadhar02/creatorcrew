/**
 * Server-only post enrichment. Calls Gemini once per creator_posts row,
 * returns a structured AI overview + taxonomy that Discover ranking, Boost
 * menus, and the post detail modal consume directly.
 *
 * Idempotent: re-running on an already-enriched post is a no-op unless the
 * `force` flag is passed.
 */
import { GoogleGenAI, Type } from "@google/genai";
import { getSupabase } from "./supabase";
import type { EnrichmentResult } from "./types-enrichment";

const apiKey = process.env.GEMINI_API_KEY!;
const model = process.env.ENRICH_MODEL || "gemini-2.5-flash";

if (!apiKey) {
  console.warn("GEMINI_API_KEY missing — enrichment will fail.");
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: [
    "taxonomyId",
    "taxonomyLabel",
    "taxonomyTier1",
    "contentTypeLabel",
    "mediaFormat",
    "mood",
    "aiTags",
    "aiDescription",
    "aiOverview",
  ],
  properties: {
    taxonomyId: {
      type: Type.STRING,
      description:
        "Hierarchical ID like ext:tier1__tier2__tier3 — pick best fit from: ext:productivity, ext:self_improvement, ext:business, ext:health, ext:content_creation, ext:psychology. Add tier2/tier3 if confident (e.g. ext:productivity__automation__ai_agents).",
    },
    taxonomyLabel: {
      type: Type.STRING,
      description:
        "Human-readable breadcrumb separated by ' › ' (e.g. 'Productivity › Automation › AI agents').",
    },
    taxonomyTier1: {
      type: Type.STRING,
      description:
        "Top-level tier: Productivity, Self-improvement, Business, Health & fitness, Content creation, or Psychology.",
    },
    contentTypeLabel: {
      type: Type.STRING,
      description:
        "One of: tutorial, explainer, story, promo, listicle, review, opinion, demo, news, q_and_a.",
    },
    mediaFormat: {
      type: Type.STRING,
      description:
        "One of: short_video, long_video, image, carousel, article.",
    },
    mood: {
      type: Type.STRING,
      description:
        "One of: educational, motivational, analytical, entertaining, provocative, calming, urgent.",
    },
    aiTags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "5–10 free-text topical tags, lowercase, hyphen-separated.",
    },
    aiDescription: {
      type: Type.STRING,
      description: "2–3 sentence neutral summary of the post's content.",
    },
    aiOverview: {
      type: Type.OBJECT,
      required: ["blocks"],
      properties: {
        blocks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            required: ["type"],
            properties: {
              type: {
                type: Type.STRING,
                description:
                  "Block kind: hook | pullQuotes | format | structure | devices | generic",
              },
              mechanic: { type: Type.STRING },
              openingLine: { type: Type.STRING },
              why: { type: Type.STRING },
              tone: { type: Type.STRING },
              items: { type: Type.ARRAY, items: { type: Type.STRING } },
              label: { type: Type.STRING },
              detail: { type: Type.STRING },
              stages: { type: Type.ARRAY, items: { type: Type.STRING } },
              body: { type: Type.STRING },
            },
          },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `You are a content analyst. Reverse-engineer the post below into a structured AI overview that a creator can riff on.

Output JSON only. Always include at minimum a "hook" block and a "pullQuotes" block. Add structure/devices/format blocks when the source supports it.

For the hook block:
- mechanic: the rhetorical move (e.g. "curiosity gap", "bold claim", "contrarian setup", "specific number", "concrete promise").
- openingLine: a verbatim quote of the post's first sentence/clause.
- why: 1–2 sentences on why that opener works.

For pullQuotes: 2–4 standalone lines worth saving. Verbatim from the source.

No em dashes or en dashes anywhere in your output — replace with hyphens or full stops.`;

function buildPrompt(post: {
  platform: string;
  title_or_caption: string | null;
  transcript: string | null;
  vision_analysis_md: string | null;
  media_type: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
}): string {
  const parts: string[] = [];
  parts.push(SYSTEM_PROMPT);
  parts.push("---");
  parts.push(`Platform: ${post.platform}`);
  if (post.media_type) parts.push(`Media type: ${post.media_type}`);
  parts.push(
    `Stats: ${post.view_count} views · ${post.like_count} likes · ${post.comment_count} comments`
  );
  if (post.title_or_caption) {
    parts.push("\nCaption / title:");
    parts.push(post.title_or_caption);
  }
  if (post.transcript) {
    parts.push("\nTranscript:");
    parts.push(post.transcript.slice(0, 8000));
  }
  if (post.vision_analysis_md) {
    parts.push("\nVision analysis:");
    parts.push(post.vision_analysis_md.slice(0, 4000));
  }
  return parts.join("\n");
}

/**
 * Enrich a single creator_posts row. Returns the new enrichment data; the
 * caller (or the API route below) is responsible for persisting it.
 */
export async function enrichPost(
  postId: string,
  opts: { force?: boolean } = {}
): Promise<EnrichmentResult | null> {
  const sb = getSupabase();
  const { data: row, error } = await sb
    .from("creator_posts")
    .select(
      "id, platform, title_or_caption, transcript, vision_analysis_md, media_type, view_count, like_count, comment_count, enriched_at"
    )
    .eq("id", postId)
    .maybeSingle();
  if (error || !row) return null;
  if (
    !opts.force &&
    (row as { enriched_at: string | null }).enriched_at
  ) {
    // Already enriched — fetch the existing result.
    const { data: existing } = await sb
      .from("creator_posts")
      .select(
        "taxonomy_id, taxonomy_label, taxonomy_tier1, content_type_label, media_format, mood, ai_tags, ai_description, ai_overview"
      )
      .eq("id", postId)
      .maybeSingle();
    if (existing) {
      const e = existing as Record<string, unknown>;
      return {
        taxonomyId: (e.taxonomy_id as string) || "",
        taxonomyLabel: (e.taxonomy_label as string) || "",
        taxonomyTier1: (e.taxonomy_tier1 as string) || "",
        contentTypeLabel: (e.content_type_label as string) || "",
        mediaFormat: (e.media_format as string) || "",
        mood: (e.mood as string) || "",
        aiTags: (e.ai_tags as string[]) || [],
        aiDescription: (e.ai_description as string) || "",
        aiOverview: (e.ai_overview as { blocks: never[] }) || { blocks: [] },
      };
    }
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildPrompt(
    row as Parameters<typeof buildPrompt>[0]
  );
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.4,
    },
  });
  const text = response.text;
  if (!text) return null;
  let parsed: EnrichmentResult;
  try {
    parsed = JSON.parse(text) as EnrichmentResult;
  } catch {
    return null;
  }

  // Strip em/en dashes globally — Eden's #1 AI-text tell.
  const stripDashes = (s: string) =>
    s.replace(/—/g, "-").replace(/–/g, "-");
  parsed.aiDescription = stripDashes(parsed.aiDescription || "");
  if (parsed.aiOverview?.blocks) {
    for (const b of parsed.aiOverview.blocks) {
      const obj = b as Record<string, unknown>;
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (typeof v === "string") {
          obj[k] = stripDashes(v);
        } else if (Array.isArray(v)) {
          obj[k] = (v as unknown[]).map((x) =>
            typeof x === "string" ? stripDashes(x) : x
          );
        }
      }
    }
  }

  // Persist
  const now = new Date().toISOString();
  await sb
    .from("creator_posts")
    .update({
      taxonomy_id: parsed.taxonomyId,
      taxonomy_label: parsed.taxonomyLabel,
      taxonomy_tier1: parsed.taxonomyTier1,
      content_type_label: parsed.contentTypeLabel,
      media_format: parsed.mediaFormat,
      mood: parsed.mood,
      ai_tags: parsed.aiTags,
      ai_description: parsed.aiDescription,
      ai_overview: parsed.aiOverview,
      enriched_at: now,
      ai_overview_generated_at: now,
    })
    .eq("id", postId);

  const { enqueueEmbed } = await import("./embed-post");
  enqueueEmbed(postId);

  return parsed;
}

/**
 * Batch-enrich pending posts. Picks up to `limit` rows where enriched_at is
 * null, runs `concurrency` enrichments in parallel, and returns the count
 * that succeeded. Safe to call from a cron / one-off API route.
 */
export async function enrichAllPending(
  limit = 50,
  concurrency = 4
): Promise<{ enriched: number; attempted: number; failed: number }> {
  const sb = getSupabase();
  const { data: pending } = await sb
    .from("creator_posts")
    .select("id")
    .is("enriched_at", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  const ids = (pending || []).map((p) => (p as { id: string }).id);

  let enriched = 0;
  let failed = 0;
  for (let i = 0; i < ids.length; i += concurrency) {
    const slice = ids.slice(i, i + concurrency);
    const results = await Promise.allSettled(slice.map((id) => enrichPost(id)));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) enriched += 1;
      else failed += 1;
    }
  }

  return { enriched, attempted: ids.length, failed };
}
