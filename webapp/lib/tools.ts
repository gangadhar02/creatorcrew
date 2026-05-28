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
