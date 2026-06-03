"use client";

import { Play } from "lucide-react";

export function FounderStory() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 md:gap-16 items-center">
        <div>
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-brand">
            Why we built this
          </span>
          <h2 className="font-display text-3xl md:text-5xl font-semibold leading-tight mt-3 mb-6 text-balance">
            I got tired of starting from zero every day.
          </h2>
          <div className="space-y-4 text-base md:text-lg text-muted-foreground leading-relaxed text-pretty">
            <p>
              Filming and posting were never the hard part. The hard part was the empty screen every morning, and the nagging worry that whatever I made would sound like everyone else.
            </p>
            <p>
              I saved posts I loved and never found them again. I studied creators I admired and forgot what made them click by the time I sat down to work.
            </p>
            <p>
              So I built a crew to carry all of it: the trends, the swipe files, the voice. CreatorCrew is that crew, and it&apos;s the head start I kept wishing I had.
            </p>
          </div>
          <div className="mt-7 flex items-center gap-3">
            {/* Placeholder avatar — swap for a real founder photo. */}
            <div className="size-11 rounded-full bg-gradient-to-br from-brand to-amber-400" />
            <div className="text-sm">
              <div className="font-semibold">[Your name]</div>
              <div className="text-muted-foreground text-[13px]">Founder, CreatorCrew</div>
            </div>
          </div>
        </div>

        {/* Placeholder launch-video thumbnail — drop in a real embed/poster later. */}
        <div className="relative aspect-video rounded-3xl bg-secondary ring-1 ring-border overflow-hidden grid place-items-center">
          <div className="absolute inset-0 dot-grid text-foreground/15 pointer-events-none" />
          <button
            type="button"
            aria-label="Play launch video (placeholder)"
            className="relative grid place-items-center size-16 rounded-full bg-brand text-brand-foreground shadow-lg transition-transform hover:scale-105"
          >
            <Play className="size-6 fill-current" />
          </button>
          <span className="absolute bottom-4 left-4 text-[11px] uppercase tracking-widest text-muted-foreground">
            [Launch video]
          </span>
        </div>
      </div>
    </section>
  );
}
