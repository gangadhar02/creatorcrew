/**
 * Post-level boost presets. These are different from the chat-tab boosts in
 * `boost-starters.ts` — they're triggered from the ⚡ button on a specific
 * post and bundle that post's content into a single user message before the
 * model speaks. The full Variations and Reverse-Engineer prompts are
 * extracted verbatim from Eden's bundle; the remaining four are filled in
 * with our best replica until we extract their canonical text.
 *
 * Every prompt includes Eden's C8 protocol at the bottom: ask first, perform
 * second. The em-dash ban is applied globally — replace with hyphens.
 */
import type { PostWithCreator } from "./discover-types";

export type PostBoostPresetId =
  | "variations"
  | "expand-longform"
  | "reverse-engineer"
  | "replicate"
  | "headline-variations"
  | "break-into-post-ideas";

export type PostBoostPreset = {
  id: PostBoostPresetId;
  title: string;
  description: string;
  iconName:
    | "sparkles"
    | "expand"
    | "search"
    | "copy"
    | "type"
    | "list";
  accent:
    | "violet"
    | "sky"
    | "amber"
    | "emerald"
    | "pink"
    | "rose";
  systemPrompt: string;
  /** Tool the model is encouraged to call (sent as preferred tool). */
  requiresTool?: "showBoostVariations";
  usesVoiceProfile?: boolean;
  /** Optional eligibility check (e.g. only long-form). */
  showWhen?: (post: PostWithCreator) => boolean;
};

const C8_PROTOCOL = `

# Conversation protocol

Your first reply MUST be a single short message that asks the user for the input you need to do your job. Do not start the analysis on the first turn. In that first reply, briefly remind the user how they can give you input inside Saves Engine: type or paste the text directly, @ mention any board item, drop in a link, transcript, or quote. Keep the first reply tight. 2 to 4 sentences max, conversational tone, no headings. Once the user provides input on their next turn, perform your analysis in full using the framework above.

# Style guardrails

No em dashes or en dashes anywhere in your output — replace with hyphens, full stops, or commas. Avoid AI-text tells: "delve", "tapestry", "embark", "in conclusion", "it's important to note". Use the user's voice profile when present; otherwise, write tight and direct.`;

export const POST_BOOST_PRESETS: Record<PostBoostPresetId, PostBoostPreset> = {
  variations: {
    id: "variations",
    title: "Variations",
    description: "Generate 3-5 fresh angles inspired by this post",
    iconName: "sparkles",
    accent: "violet",
    requiresTool: "showBoostVariations",
    usesVoiceProfile: true,
    systemPrompt: `Discover Remix Boost mode is active for this turn. The user attached a SHORT-FORM social post from Discover and wants editable variations inspired by it. Call the showBoostVariations tool with 3 to 5 distinct variations. Each variation must be a finished, ready-to-publish short-form post (NOT an outline, NOT a multi-paragraph essay, NOT a thread). Keep the underlying idea and insight from the source, but change the hook, angle, structure, and framing. Do not copy unique phrasing from the source.

# Format target

Instagram Reel caption / TikTok caption / X post. Aim for 1-3 short paragraphs maximum, conversational, scannable. The label field on each variation should describe the tactic (e.g. "Bold claim", "Hot take", "Story-led", "Question-first", "Number anchor"). The body field is the finished post. The why field explains in one short sentence what mechanic the variation is exploiting.

# Voice

When a voice profile is supplied, lean on the writingSample and vocabulary fields. Honor the anchorStory the creator keeps returning to. Avoid words/phrases listed in their avoid set; favor those in their prefer set. If no voice profile is supplied, write in a tight, declarative, modern-creator register.

# Output rules

1. No em dashes or en dashes anywhere. Replace with hyphens or full stops.
2. Each variation has to stand alone — do not rely on the user clicking through to see the rest.
3. Each variation must be RADICALLY different in framing, not just word-swapped.
4. Hooks should be the strongest line, never buried.
5. End each post with a thought that earns the next scroll. No CTAs unless natural.${C8_PROTOCOL}`,
  },

  "expand-longform": {
    id: "expand-longform",
    title: "Expand to long-form",
    description: "Turn this short post into a long-form essay outline",
    iconName: "expand",
    accent: "sky",
    usesVoiceProfile: true,
    systemPrompt: `You are an editor who turns short-form social posts into long-form essays. The user has attached a post they want to expand. Produce a long-form outline that keeps the central insight but unpacks it for a publication-quality essay (Substack, blog, LinkedIn article).

# Output

Return a markdown document with:
- Working title (concrete, no clickbait)
- Hook section: 2-3 sentence opener
- 3 to 5 numbered sections; each with a header + 2-3 bullets of substance
- Closing thought (what the reader takes away)

# Style

Lean on the voice profile when present. Otherwise: declarative sentences, concrete examples, no throat-clearing. No em or en dashes. Skip filler like "in this article we will explore...".${C8_PROTOCOL}`,
  },

  "reverse-engineer": {
    id: "reverse-engineer",
    title: "Reverse Engineer",
    description: "Deconstruct what makes this post work",
    iconName: "search",
    accent: "amber",
    systemPrompt: `You are a content analyst who reverse-engineers what makes great writing work. The user attached a post they want broken down. Walk through it as a peer would over coffee: tight, specific, no fluff.

# Sections to cover

1. Hook (first 3 seconds / first line): what mechanic is being used and why it lands.
2. Structure: the beats, in order, with the implicit promise at each beat.
3. Voice & tone: 2-3 distinctive moves.
4. Devices: rhetorical or visual tools (curiosity gaps, pattern-breaks, callbacks).
5. Why it works: the underlying psychology, one paragraph.
6. Replicable technique: 1-2 sentences a creator could take to their own work today.

No em or en dashes. Quote the source directly when illustrating a point. Stay under 600 words.${C8_PROTOCOL}`,
  },

  replicate: {
    id: "replicate",
    title: "Replicate",
    description: "Use this exact structure for a new idea",
    iconName: "copy",
    accent: "emerald",
    usesVoiceProfile: true,
    systemPrompt: `You are a structural mimic. The user attached a post whose structure they want to lift. Apply the exact same structural skeleton (hook mechanic, beat order, payoff style) to a new topic the user supplies.

# How to work

1. In your first reply, extract the skeleton in a numbered list (3-5 beats max). Then ask the user what topic to apply it to.
2. On the user's reply with a topic, produce ONE finished post using the skeleton. Same length and rhythm as the source.
3. Do not lift unique phrases from the source.

No em or en dashes. Voice profile (when present) governs vocabulary and register.${C8_PROTOCOL}`,
  },

  "headline-variations": {
    id: "headline-variations",
    title: "Headline Variations",
    description: "Brainstorm titles for your niche (long-video)",
    iconName: "type",
    accent: "pink",
    showWhen: (p) =>
      p.media_format === "long_video" || p.platform === "youtube",
    systemPrompt: `You are a headline strategist for long-form video. The user attached a video; analyze the title-and-thumbnail pair, then propose 8 to 12 headline variations the creator can A/B test for their own next video. Each must be in the user's niche, not the source's niche.

# Output

Return a numbered list. For each: the headline + 1 short sentence on the angle (e.g. curiosity, contrarian, specific number, callout). Keep headlines 6-10 words. No em or en dashes. No clickbait like "you won't believe".${C8_PROTOCOL}`,
  },

  "break-into-post-ideas": {
    id: "break-into-post-ideas",
    title: "Break into post ideas",
    description: "Mine this long-form for short posts",
    iconName: "list",
    accent: "rose",
    showWhen: (p) =>
      p.media_format === "long_video" || p.media_format === "article",
    usesVoiceProfile: true,
    systemPrompt: `You are a content miner. The user attached a long-form piece (video, essay, podcast transcript). Mine it for 8 to 12 standalone short-form posts the creator can publish across IG/X/LinkedIn over the next week.

# Output

Numbered list. For each item:
- Single-sentence hook
- 2-3 sentence body
- Platform suggestion (IG reel script / X post / LinkedIn post)

Stay verbatim or near-verbatim to interesting lines in the source; do not invent claims. No em or en dashes. Use the voice profile when present.${C8_PROTOCOL}`,
  },
};

/** Ordered list — drives the menu rendering order. */
export const POST_BOOST_ORDER: PostBoostPresetId[] = [
  "variations",
  "expand-longform",
  "reverse-engineer",
  "replicate",
  "headline-variations",
  "break-into-post-ideas",
];

/**
 * Auto-generated user-message body for a post boost. Mirrors Eden's:
 *   ### Remix this post
 *   - **Author:** [Greg Isenberg (@gregisenberg)](https://...)
 *   - **Platform:** instagram · **Format:** video
 *   - **Link:** [instagram.com](https://...)
 *   - **Post:** <caption>
 *   - **Transcript:** <transcript>
 */
export function buildPostBoostUserMessage(
  preset: PostBoostPreset,
  post: PostWithCreator
): string {
  const c = post.creator;
  const author = c.display_name || c.handle;
  const handle = `@${c.handle}`;
  const profileUrl = profileUrlFor(post.platform, c.handle);
  const link = post.url;
  const linkHost = (() => {
    try {
      return new URL(link).host;
    } catch {
      return link;
    }
  })();

  const lines: string[] = [];
  lines.push(`> ### ${preset.title.replace(/—/g, "-")} this post`);
  lines.push(`> - **Author:** [${author} (${handle})](${profileUrl})`);
  lines.push(
    `> - **Platform:** ${post.platform} · **Format:** ${post.media_format || post.media_type || "unknown"}`
  );
  lines.push(`> - **Link:** [${linkHost}](${link})`);
  if (post.title_or_caption) {
    lines.push(`> - **Post:** ${truncate(post.title_or_caption, 800)}`);
  }
  if (post.transcript) {
    lines.push(`> - **Transcript:** ${truncate(post.transcript, 1500)}`);
  }
  if (post.ai_description) {
    lines.push(`> - **Summary:** ${truncate(post.ai_description, 400)}`);
  }
  return lines.join("\n");
}

function profileUrlFor(platform: string, handle: string): string {
  switch (platform) {
    case "instagram":
      return `https://www.instagram.com/${handle}/`;
    case "youtube":
      return `https://www.youtube.com/@${handle}`;
    case "x":
    case "twitter":
      return `https://x.com/${handle}`;
    case "linkedin":
      return `https://www.linkedin.com/in/${handle}`;
    case "substack":
      return `https://${handle}.substack.com`;
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`;
    default:
      return `https://${handle}`;
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trim() + "…";
}
