/**
 * Shape of `creator_posts.ai_overview` and friends. Stored as JSONB so the
 * structure is forward-flexible — block-level rendering is in the frontend.
 */

export type AiOverviewBlock =
  | {
      type: "hook";
      mechanic: string;
      openingLine: string;
      why: string;
      tone?: "accent" | "neutral";
    }
  | {
      type: "pullQuotes";
      items: string[];
    }
  | {
      type: "format";
      label: string;
      detail?: string;
    }
  | {
      type: "structure";
      stages: string[];
    }
  | {
      type: "devices";
      items: { label: string; example?: string }[];
    }
  | {
      type: "generic";
      label: string;
      body: string;
    };

export type AiOverview = {
  blocks: AiOverviewBlock[];
};

export type EnrichmentResult = {
  taxonomyId: string; // ext:tier1__tier2__tier3
  taxonomyLabel: string; // human-readable breadcrumb
  taxonomyTier1: string;
  contentTypeLabel: string; // "tutorial" | "explainer" | "story" | …
  mediaFormat: string; // "short_video" | "long_video" | "image" | "carousel" | "article"
  mood: string; // "educational" | "motivational" | …
  aiTags: string[];
  aiDescription: string;
  aiOverview: AiOverview;
};

export type EnrichedPostFields = {
  taxonomy_id: string | null;
  taxonomy_label: string | null;
  taxonomy_tier1: string | null;
  content_type_label: string | null;
  media_format: string | null;
  mood: string | null;
  ai_tags: string[] | null;
  ai_description: string | null;
  ai_overview: AiOverview | null;
  enriched_at: string | null;
  ai_overview_generated_at: string | null;
};
