"use client";

import { EmailCaptureForm } from "./EmailCaptureForm";
import { HeroMockup } from "./HeroMockup";

export function Hero() {
  return (
    <section id="start" className="relative pt-16 md:pt-24 pb-12 px-6 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[400px] bg-gradient-to-b from-brand/10 via-brand/5 to-transparent pointer-events-none" />
      <div className="relative max-w-7xl mx-auto text-center">
        <a href="#features" className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card text-[11px] font-medium text-muted-foreground mb-7 hover:text-foreground transition-colors">
          <span className="size-1.5 rounded-full bg-brand" />
          New · Meet your AI content crew
        </a>
        <h1 className="font-display text-5xl md:text-7xl font-semibold leading-[1.02] text-balance max-w-[18ch] mx-auto mb-7">
          A crew of AI agents that create content with you.
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-[52ch] mx-auto mb-10 text-pretty">
          CreatorCrew is your AI second brain for content. Your crew tracks what&apos;s trending in your niche, learns your voice from your past posts, then ideates and writes your next post in your tone.
        </p>

        <EmailCaptureForm />

        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span>Free forever plan · No credit card</span>
          <span aria-hidden>·</span>
          <a href="#how" className="underline-offset-4 hover:underline">See how it works</a>
        </div>

        <div className="mt-16 md:mt-20">
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}