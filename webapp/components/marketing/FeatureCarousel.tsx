"use client";

import { useRef, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  DiscoverMockup,
  ProfileMockup,
  IdeationMockup,
  CopilotMockup,
  VisionMockup,
  CanvasMockup,
  SaveMockup,
  VoiceMockup,
} from "./FeatureMockups";

type Card = { title: string; body: string; visual: ReactNode };

// Left edge of the centered content column (max-w-7xl = 80rem + px-6 = 1.5rem
// gutter). The carousel starts its first card here so it lines up with the
// heading above it.
// Use 100% (the track's content-box width, scrollbar-excluded) rather than
// 100vw so this matches the centered container exactly even with a scrollbar.
const GUTTER = "max(1.5rem, calc((100% - 80rem) / 2 + 1.5rem))";

// The mockups were authored for a ~wide column. Lay each one out at this
// comfortable design width, then scale it down uniformly to fit the card so
// proportions stay correct (no squished grids). Card is 360px wide with a
// 20px inset on each side, so the scaled mockup spans 320px.
const DESIGN_W = 480;
const VIS_SCALE = (360 - 20 * 2) / DESIGN_W; // 320 / 480 ≈ 0.667

// Each agent in the crew owns one part of the job. Covers reels, video,
// posts, and scripts across every major platform.
const CARDS: Card[] = [
  {
    title: "Your scout finds what's already working.",
    body: "It watches reels, video, and posts across Instagram, YouTube, X, and TikTok, then flags the outliers worth modeling, ranked by reach and format.",
    visual: <DiscoverMockup />,
  },
  {
    title: "Pin the creators you learn from.",
    body: "Add anyone to a watchlist and slice their feed by reach, format, or what's outperforming. Their playbook stays a click away.",
    visual: <ProfileMockup />,
  },
  {
    title: "Start from a layout that already landed.",
    body: "Open a proven shape for a reel, post, or script, and let the crew talk you through making it yours.",
    visual: <IdeationMockup />,
  },
  {
    title: "Spin one idea into a week of posts.",
    body: "Hand the crew a single idea and get versions for every format and platform, enough to fill the calendar without starting over.",
    visual: <CopilotMockup />,
  },
  {
    title: "Take apart any post, keep the skeleton.",
    body: "Paste a link and the crew maps the hook, the middle, and the payoff, then rebuilds that shape around your idea instead of its words.",
    visual: <VisionMockup />,
  },
  {
    title: "Talk to any video, reel, or post.",
    body: "The crew transcribes whatever you save, so you can question it, summarize it, or remix it like it was your own notes.",
    visual: <SaveMockup />,
  },
  {
    title: "Keep every spark in one place.",
    body: "Drop a link or save on the fly into themed boards. Reopen one the moment you need a fresh angle on the same topic.",
    visual: <CanvasMockup />,
  },
  {
    title: "Draft, outline, and script side by side.",
    body: "Everything you've saved sits right next to the page, so the blank screen never gets the last word.",
    visual: <VoiceMockup />,
  },
];

export function FeatureCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollByCard(dir: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>("[data-card]");
    const amount = card ? card.offsetWidth + 20 : track.clientWidth * 0.8;
    track.scrollBy({ left: dir * amount, behavior: "smooth" });
  }

  return (
    <section id="features" className="py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 flex items-end justify-between gap-8 mb-12">
        <div className="max-w-2xl">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-brand">Meet the crew</span>
          <h2 className="font-display text-3xl md:text-5xl font-semibold leading-tight mt-3 text-balance">
            One crew. Every step from spark to post.
          </h2>
        </div>
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <button
            type="button"
            aria-label="Previous"
            onClick={() => scrollByCard(-1)}
            className="grid place-items-center size-10 rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent"
          >
            <ArrowLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => scrollByCard(1)}
            className="grid place-items-center size-10 rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent"
          >
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="snap-x-track flex gap-5 overflow-x-auto pt-3 pb-6"
        style={{
          // Align the first card with the centered content column (same left
          // edge as the heading), while cards still bleed off the right.
          paddingLeft: GUTTER,
          paddingRight: "1.5rem",
          scrollPaddingLeft: GUTTER,
          maskImage: `linear-gradient(to right, transparent 0, black ${GUTTER}, black calc(100% - 1.5rem), transparent 100%)`,
          WebkitMaskImage: `linear-gradient(to right, transparent 0, black ${GUTTER}, black calc(100% - 1.5rem), transparent 100%)`,
        }}
      >
        {CARDS.map((card) => (
          <article
            key={card.title}
            data-card
            className="card-hover shrink-0 w-[360px] rounded-3xl bg-card ring-1 ring-border overflow-hidden flex flex-col"
          >
            {/* Visual: render the mockup at its comfortable design width, then
                scale the whole thing down so proportions stay intact instead of
                getting squished. Bottom fades out for a clean peek. */}
            <div
              className="relative h-56 overflow-hidden bg-secondary/30"
              style={{
                maskImage: "linear-gradient(to bottom, black 74%, transparent)",
                WebkitMaskImage: "linear-gradient(to bottom, black 74%, transparent)",
              }}
            >
              <div
                className="pointer-events-none absolute left-5 top-5 origin-top-left"
                style={{ width: `${DESIGN_W}px`, transform: `scale(${VIS_SCALE})` }}
              >
                {card.visual}
              </div>
            </div>
            <div className="p-6 flex-1">
              <h3 className="font-display text-lg font-semibold leading-snug text-balance">{card.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2.5 text-pretty">{card.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
