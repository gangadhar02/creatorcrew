"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SaveMockup,
  VisionMockup,
  DiscoverMockup,
  ProfileMockup,
  CopilotMockup,
  VoiceMockup,
  CanvasMockup,
  IdeationMockup,
} from "./FeatureMockups";

type Feature = {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  mockup: ReactNode;
};

const features: Feature[] = [
  {
    eyebrow: "Capture",
    title: "Save anything, in one searchable library.",
    body: "Pull in your Instagram saves and bookmarks automatically. No more lost screenshots — every spark of inspiration lives in one place.",
    bullets: ["Auto-import from Instagram", "Save from anywhere with the extension", "Search by what you remember, not where you saved it"],
    mockup: <SaveMockup />,
  },
  {
    eyebrow: "Understand",
    title: "AI that actually reads your saves.",
    body: "Every saved reel and image is analyzed — visuals, transcripts, and themes — so you can search and understand why something works.",
    bullets: ["Vision tagging on every image and reel", "Full transcripts on saved video", "Search by mood, topic, or hook style"],
    mockup: <VisionMockup />,
  },
  {
    eyebrow: "Discover",
    title: "Find what actually performs.",
    body: "Surface top-performing posts and creators in your niche. Spot outliers — the posts that massively over-performed — so you model what works, not what's average.",
    bullets: ["Outlier detection vs creator baseline", "Niche feeds tailored to your boards", "Performance signals, not vanity averages"],
    mockup: <DiscoverMockup />,
  },
  {
    eyebrow: "Analyze",
    title: "Decode any creator in seconds.",
    body: "Drop a public Instagram profile and get typical reel views, engagement, and breakout posts. Understand any creator's playbook in a glance.",
    bullets: ["Profile-level engagement snapshot", "Breakout post detection", "Side-by-side competitor view"],
    mockup: <ProfileMockup />,
  },
  {
    eyebrow: "Create",
    title: "Chat with an AI that knows your taste.",
    body: "A creative copilot aware of your saved content and your voice. Ideate, remix, write a hook, or break down why a reel went viral. Attach images and PDFs.",
    bullets: ["Grounded in your library, not the open web", "Vision + transcript on demand", "Voice-matched drafts"],
    mockup: <CopilotMockup />,
  },
  {
    eyebrow: "Voice",
    title: "Your voice, captured once.",
    body: "Extract your writing voice and style once, then have every idea and draft generated in your tone — not generic AI mush.",
    bullets: ["Style fingerprint from your posts", "Tone presets per content pillar", "Always sounds like you"],
    mockup: <VoiceMockup />,
  },
  {
    eyebrow: "Canvas",
    title: "An infinite canvas for messy thinking.",
    body: "Collect, arrange, and connect content on a freeform board. Paste any Instagram link to drop it in as a card, sketch and add notes, and go fullscreen for distraction-free creating.",
    bullets: ["Paste a link, get a card", "Freeform notes + sketches", "Group ideas into campaigns"],
    mockup: <CanvasMockup />,
  },
  {
    eyebrow: "Ideation",
    title: "Turn saves into a content pipeline.",
    body: "Convert inspiration into a steady pipeline of ideas, organized by your content pillars and ready to ship.",
    bullets: ["Pillar-based idea queues", "One-click promote to draft", "Always know what's next"],
    mockup: <IdeationMockup />,
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mb-16">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-brand">The product</span>
          <h2 className="font-display text-3xl md:text-5xl font-semibold leading-tight mt-3 text-balance">
            Everything you need between the idea and the post.
          </h2>
        </div>

        <div className="space-y-28 md:space-y-32">
          {features.map((f, i) => (
            <FeatureRow key={f.title} feature={f} reverse={i % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureRow({ feature, reverse }: { feature: Feature; reverse: boolean }) {
  return (
    <div className="grid md:grid-cols-12 gap-10 md:gap-16 items-center">
      <div className={cn("md:col-span-5", reverse && "md:order-2")}>
        <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-brand">{feature.eyebrow}</span>
        <h3 className="font-display text-3xl md:text-4xl font-semibold leading-tight mt-3 mb-5 text-balance">
          {feature.title}
        </h3>
        <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-7 text-pretty">{feature.body}</p>
        <ul className="space-y-3">
          {feature.bullets.map((b) => (
            <li key={b} className="flex items-start gap-3 text-sm font-medium text-foreground/80">
              <span className="grid place-items-center size-5 rounded-full bg-brand/15 text-brand mt-0.5 shrink-0">
                <Check className="size-3" strokeWidth={3} />
              </span>
              {b}
            </li>
          ))}
        </ul>
      </div>
      <div className={cn("md:col-span-7", reverse && "md:order-1")}>{feature.mockup}</div>
    </div>
  );
}