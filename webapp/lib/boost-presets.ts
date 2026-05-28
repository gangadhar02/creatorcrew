/**
 * Boost actions — starter prompts injected as the first user message when
 * the user clicks the lightning icon on a post. The chat itself runs in
 * Phase 10; for now this is what /api/boost returns.
 */

export type BoostAction =
  | "variations"
  | "reverse_engineer"
  | "replicate"
  | "headline_variations"
  | "expand_to_long_form"
  | "break_into_posts";

export const BOOST_PRESETS: Record<
  BoostAction,
  { label: string; description: string; prompt: string }
> = {
  variations: {
    label: "Variations",
    description: "5 versions of this post in your voice.",
    prompt:
      "Generate 5 variations of this post in my voice. Keep the core idea but vary the angle, hook style, and structure. Each variation should be standalone (not requiring the others as context).",
  },
  reverse_engineer: {
    label: "Reverse engineer",
    description: "Deconstruct what makes this work.",
    prompt:
      "Reverse-engineer this post. Break down: (1) the hook in the first 3 seconds and exactly why it works, (2) the structure/beats, (3) the on-screen text or carousel slide pattern if applicable, (4) the audio/voiceover approach, (5) the call-to-action mechanic, (6) what I'd specifically need to lift to replicate this — concrete moves, not principles.",
  },
  replicate: {
    label: "Replicate",
    description: "Apply the exact structure to a topic of mine.",
    prompt:
      "Apply this post's exact structure to a topic from my niche. Pick the topic first based on my voice and audience, then map every beat of the original onto the new topic — hook style, transitions, CTA pattern, all of it.",
  },
  headline_variations: {
    label: "Headline variations",
    description: "10 hook/title alternatives.",
    prompt:
      "Write 10 alternative hooks/headlines for this post. Cover the 3 styles: Curiosity (open loops), Value (concrete promise), Emotional (stakes/identity). Mix punchy short headlines with longer setup-heavy ones.",
  },
  expand_to_long_form: {
    label: "Expand to long-form",
    description: "Outline a YouTube/newsletter version.",
    prompt:
      "Expand this short-form post into a long-form outline (5-10 minute YouTube video OR a newsletter article — pick whichever fits the topic better). Include: hook, 4-6 main beats with brief reasoning for each, a story or example per beat, and a closing CTA. Match my voice.",
  },
  break_into_posts: {
    label: "Break into posts",
    description: "5 short-form posts from this long-form piece.",
    prompt:
      "This is a long-form piece. Break it into 5 standalone short-form posts (each works on its own). For each: title, hook, the 3-5 line body, format suggestion (carousel / reel / tweet). Match my voice.",
  },
};
