/**
 * Boost starters — labeled chat-starter prompts shown on the new-chat home.
 * Matches the founder's demo screenshot of the chat home.
 */
export type StarterKey =
  | "content_breakdown"
  | "thinking_partner"
  | "start_writing"
  | "grade_my_content"
  | "niche_playbook";

export const BOOST_STARTERS: Record<
  StarterKey,
  { label: string; icon: string; prompt: string; description: string }
> = {
  content_breakdown: {
    label: "Content Breakdown",
    icon: "🔪",
    description: "Paste a link or attach a post; get the full deconstruction.",
    prompt:
      "I want a full content breakdown. Tell me what to attach (a post, a video, a thread, a board) and once it's attached, deconstruct it: hook in first 3 seconds, structure/beats, on-screen text, audio approach, replicable technique, and a verdict on whether this is worth replicating.",
  },
  thinking_partner: {
    label: "Thinking Partner",
    icon: "🧠",
    description: "Push back on my ideas, ask sharp questions, help me think clearer.",
    prompt:
      "Be my thinking partner. I'm going to tell you about an idea / a problem / a decision. Push back where my reasoning is weak. Ask sharp questions before answering. Don't validate — clarify.",
  },
  start_writing: {
    label: "Start Writing",
    icon: "✏️",
    description: "Help me draft the next piece of content in my voice.",
    prompt:
      "Help me start writing. I'll tell you the topic and the format (reel / tweet / carousel / newsletter). Use my voice. Ask me 1-2 clarifying questions first if anything is ambiguous, then start with a hook + outline. Don't write the full thing yet — let me steer.",
  },
  grade_my_content: {
    label: "Grade My Content",
    icon: "📊",
    description: "Paste a draft; I'll critique hook, structure, and stakes.",
    prompt:
      "Grade this content. Critique: (1) hook strength — does the first 3 seconds stop the scroll? (2) structure — beats clear? momentum maintained? (3) stakes — is there enough at stake for the reader/viewer? (4) my voice — does this sound like me or generic? Give a letter grade per section and one concrete fix per section.",
  },
  niche_playbook: {
    label: "Niche Playbook",
    icon: "🔥",
    description: "Top patterns that work in my niche right now.",
    prompt:
      "Generate a niche playbook based on my voice and the audience I write for. Cover: 5 hook patterns currently working in my niche (with examples), 3 structural formats to try, and 2 'don't do this' anti-patterns. Be specific to my niche, not generic creator advice.",
  },
};
