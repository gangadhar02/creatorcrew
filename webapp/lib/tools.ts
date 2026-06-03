/**
 * LLM tool schemas. Gemini's function-calling format matches OpenAI's roughly,
 * so these JSON-schema-ish objects are passed straight into config.tools.
 */
import { Type } from "@google/genai";

export const SHOW_BOOST_VARIATIONS_TOOL = {
  name: "showBoostVariations",
  description:
    "Render 3-5 ready-to-publish post variations as cards inline in the chat. Each variation has a short tactic label, a publishable body, and a one-sentence why.",
  parameters: {
    type: Type.OBJECT,
    required: ["variations"],
    properties: {
      variations: {
        type: Type.ARRAY,
        minItems: 3,
        maxItems: 5,
        items: {
          type: Type.OBJECT,
          required: ["label", "body", "why"],
          properties: {
            label: {
              type: Type.STRING,
              description:
                "Tactic name, 2-5 words (e.g. 'Bold claim', 'Hot take', 'Story-led').",
            },
            body: {
              type: Type.STRING,
              description:
                "The finished, ready-to-publish post. 1-3 short paragraphs, no em or en dashes.",
            },
            why: {
              type: Type.STRING,
              description:
                "One-sentence explanation of the mechanic this variation uses.",
            },
          },
        },
      },
    },
  },
};

export type BoostVariation = {
  label: string;
  body: string;
  why: string;
};

export type ShowBoostVariationsArgs = {
  variations: BoostVariation[];
};

// ---------- draftDocument ----------

export const DRAFT_DOCUMENT_TOOL = {
  name: "draftDocument",
  description:
    "Render a structured document (breakdown, analysis, plan) as a saveable card with a markdown body. Use for multi-section deliverables the user will likely keep, NOT for short conversational replies.",
  parameters: {
    type: Type.OBJECT,
    required: ["kind", "title", "content"],
    properties: {
      kind: {
        type: Type.STRING,
        enum: ["breakdown", "analysis", "plan", "other"],
        description: "Document category, shown as an uppercase label.",
      },
      title: { type: Type.STRING, description: "Short title, plain text." },
      content: {
        type: Type.STRING,
        description:
          "Full document body in GitHub-flavored markdown (headings, tables, bullets). No em or en dashes.",
      },
    },
  },
};

export const DRAFT_DOCUMENT_TOOL_JSON = {
  type: "function" as const,
  function: {
    name: "draftDocument",
    description:
      "Render a structured document (breakdown, analysis, plan) as a saveable card with a markdown body.",
    parameters: {
      type: "object",
      required: ["kind", "title", "content"],
      properties: {
        kind: { type: "string", enum: ["breakdown", "analysis", "plan", "other"] },
        title: { type: "string" },
        content: { type: "string" },
      },
    },
  },
};

export type DraftDocumentArgs = {
  kind: "breakdown" | "analysis" | "plan" | "other";
  title: string;
  content: string;
};

// ---------- showSocialPosts ----------

export const SHOW_SOCIAL_POSTS_TOOL = {
  name: "showSocialPosts",
  description:
    "Render a feed of real posts from the workspace as tiles (thumbnail, engagement, outlier badge). Pass postIds you learned from @-mentions or attached context. Use ONLY when the user wants to see specific posts; do not invent ids.",
  parameters: {
    type: Type.OBJECT,
    required: ["postIds"],
    properties: {
      postIds: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "creator_posts.id UUIDs to display. 1 to 12.",
      },
      handle: {
        type: Type.STRING,
        description:
          "Optional creator handle (without @) to display alongside, when postIds are not known.",
      },
      note: {
        type: Type.STRING,
        description: "Optional one-line caption shown above the feed.",
      },
    },
  },
};

export const SHOW_SOCIAL_POSTS_TOOL_JSON = {
  type: "function" as const,
  function: {
    name: "showSocialPosts",
    description:
      "Render a feed of real workspace posts as tiles. Pass postIds (creator_posts UUIDs).",
    parameters: {
      type: "object",
      required: ["postIds"],
      properties: {
        postIds: { type: "array", items: { type: "string" } },
        handle: { type: "string" },
        note: { type: "string" },
      },
    },
  },
};

export type ShowSocialPostsArgs = {
  postIds: string[];
  handle?: string;
  note?: string;
};

// Shape the SocialPostsCard fetches from /api/posts and renders per tile.
export type SocialPostTile = {
  id: string;
  url: string;
  platform: string;
  media_type: string | null;
  title_or_caption: string | null;
  thumbnail_url: string | null;
  like_count: number | null;
  comment_count: number | null;
  view_count: number | null;
  outlier_multiplier: number | null;
  creator_handle: string | null;
  creator_avatar_url: string | null;
};

// ---------- creatorSnapshot ----------

export const CREATOR_SNAPSHOT_TOOL = {
  name: "creatorSnapshot",
  description:
    "Render a compact metrics card for one creator (followers, posts indexed, avg views, engagement, outlier mean/median). Use when summarizing or analyzing a single creator's account. Provide the metrics you actually have; omit unknown ones.",
  parameters: {
    type: Type.OBJECT,
    required: ["handle", "platform"],
    properties: {
      handle: { type: Type.STRING, description: "Creator handle without @." },
      platform: { type: Type.STRING, description: "e.g. instagram, youtube." },
      displayName: { type: Type.STRING },
      followerCount: { type: Type.NUMBER },
      postsIndexed: { type: Type.NUMBER },
      totalViews: { type: Type.NUMBER },
      avgViews: { type: Type.NUMBER },
      engagementRate: { type: Type.NUMBER, description: "Percent, 0 to 100." },
      outlierMean: { type: Type.NUMBER },
      outlierMedian: { type: Type.NUMBER },
      avatarUrl: { type: Type.STRING },
      summary: { type: Type.STRING, description: "Optional one to two sentence read." },
      topPosts: {
        type: Type.ARRAY,
        description: "Optional creator_posts.id UUIDs of standout posts.",
        items: { type: Type.STRING },
      },
    },
  },
};

export const CREATOR_SNAPSHOT_TOOL_JSON = {
  type: "function" as const,
  function: {
    name: "creatorSnapshot",
    description:
      "Render a compact metrics card for one creator.",
    parameters: {
      type: "object",
      required: ["handle", "platform"],
      properties: {
        handle: { type: "string" },
        platform: { type: "string" },
        displayName: { type: "string" },
        followerCount: { type: "number" },
        postsIndexed: { type: "number" },
        totalViews: { type: "number" },
        avgViews: { type: "number" },
        engagementRate: { type: "number" },
        outlierMean: { type: "number" },
        outlierMedian: { type: "number" },
        avatarUrl: { type: "string" },
        summary: { type: "string" },
        topPosts: { type: "array", items: { type: "string" } },
      },
    },
  },
};

export type CreatorSnapshotArgs = {
  handle: string;
  platform: string;
  displayName?: string;
  followerCount?: number;
  postsIndexed?: number;
  totalViews?: number;
  avgViews?: number;
  engagementRate?: number;
  outlierMean?: number;
  outlierMedian?: number;
  avatarUrl?: string;
  summary?: string;
  topPosts?: string[];
};

// ---------- getCreatorData (server-executed DATA tool, not a render tool) ----------

export const GET_CREATOR_DATA_TOOL = {
  name: "getCreatorData",
  description:
    "Fetch REAL data for a saved creator in this workspace by handle: profile (followers, platform, bio) and aggregated post performance (posts indexed, total and average views, engagement rate, outlier mean and median) plus the top posts with their ids. ALWAYS call this first before you build a creatorSnapshot, a draftDocument analysis, or a showSocialPosts feed about a specific creator, so the cards use real numbers instead of guesses. The result is returned to you to use; it is not shown to the user. If the creator is not found the result has an error field, in which case tell the user you do not have that creator saved rather than inventing data.",
  parameters: {
    type: Type.OBJECT,
    required: ["handle"],
    properties: {
      handle: {
        type: Type.STRING,
        description: "Creator handle or name, without the @.",
      },
    },
  },
};

export type GetCreatorDataArgs = { handle: string };

// ---------- analyzeCreatorPosts (server-executed DATA tool) ----------

export const ANALYZE_CREATOR_POSTS_TOOL = {
  name: "analyzeCreatorPosts",
  description:
    "Run real per-post content analysis for a saved creator: fetches their latest (or top) posts and returns each post's transcript and/or visual (vision) analysis, generating it on demand from the actual media when not already stored. Call this when the user asks to analyze a creator's content, scripts, hooks, transcripts, visuals, or 'what they post about'. This is slower than getCreatorData, so keep count small (1 to 4). After it returns, write the detailed analysis (usually a draftDocument) grounded in the returned transcripts and vision. If a post has an error field, note that its media could not be analyzed.",
  parameters: {
    type: Type.OBJECT,
    required: ["handle"],
    properties: {
      handle: {
        type: Type.STRING,
        description: "Creator handle or name, without the @.",
      },
      count: {
        type: Type.NUMBER,
        description: "How many posts to analyze (1 to 4, default 3).",
      },
      order: {
        type: Type.STRING,
        enum: ["latest", "top"],
        description: "latest = most recent posts, top = highest viewed.",
      },
      include: {
        type: Type.ARRAY,
        items: { type: Type.STRING, enum: ["transcript", "vision"] },
        description:
          "Which analyses to run. Default both transcript and vision.",
      },
    },
  },
};

export type AnalyzeCreatorPostsArgs = {
  handle: string;
  count?: number;
  order?: "latest" | "top";
  include?: ("transcript" | "vision")[];
};

// ---------- Aggregated auto-mode tool sets ----------

// Gemini functionDeclarations (Type.* schemas), offered in AUTO mode.
// getCreatorData is a DATA tool: the route executes it and feeds the result
// back to the model (see the tool-execution loop in /api/chat). The others are
// render tools whose calls are terminal and surfaced as cards.
export const AUTO_TOOLS_GEMINI = [
  GET_CREATOR_DATA_TOOL,
  ANALYZE_CREATOR_POSTS_TOOL,
  SHOW_BOOST_VARIATIONS_TOOL,
  DRAFT_DOCUMENT_TOOL,
  SHOW_SOCIAL_POSTS_TOOL,
  CREATOR_SNAPSHOT_TOOL,
];

// Tool names the route executes server-side (and loops), rather than rendering.
export const DATA_TOOL_NAMES = [
  "getCreatorData",
  "analyzeCreatorPosts",
] as const;

// OpenRouter tools (OpenAI JSON schema), offered in AUTO mode.
export const AUTO_TOOLS_OPENROUTER = [
  // showBoostVariations JSON schema, inlined here so the route has one source.
  {
    type: "function" as const,
    function: {
      name: "showBoostVariations",
      description: "Render 3-5 ready-to-publish post variations as cards.",
      parameters: {
        type: "object",
        required: ["variations"],
        properties: {
          variations: {
            type: "array",
            minItems: 3,
            maxItems: 5,
            items: {
              type: "object",
              required: ["label", "body", "why"],
              properties: {
                label: { type: "string" },
                body: { type: "string" },
                why: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
  DRAFT_DOCUMENT_TOOL_JSON,
  SHOW_SOCIAL_POSTS_TOOL_JSON,
  CREATOR_SNAPSHOT_TOOL_JSON,
];
