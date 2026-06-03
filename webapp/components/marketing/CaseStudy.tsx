"use client";

import { Play, TrendingUp } from "lucide-react";

// PLACEHOLDER section. All numbers/names are bracketed dummies — replace with
// real case-study data before relying on this as proof.
const THUMBS = [
  { label: "[Creator one]", views: "[0.0M views]", mult: "[0.0×]" },
  { label: "[Creator two]", views: "[0.0M views]", mult: "[0.0×]" },
  { label: "[Creator three]", views: "[0.0M views]", mult: "[0.0×]" },
  { label: "[Creator four]", views: "[0.0M views]", mult: "[0.0×]" },
];

export function CaseStudy() {
  return (
    <section className="px-6 py-12">
      <div className="relative max-w-6xl mx-auto bg-foreground text-background rounded-[2.5rem] p-10 md:p-16 overflow-hidden">
        <div className="absolute inset-0 dot-grid text-background opacity-[0.06] pointer-events-none" />
        <div className="relative grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-brand">
              Proof it works [placeholder]
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-semibold leading-tight mt-3 mb-5 text-balance">
              One blueprint. [N] voices. [X]M+ views.
            </h2>
            <p className="text-background/70 leading-relaxed text-pretty">
              [Placeholder: show one proven shape that several creators rebuilt in their own voice and the numbers that followed. Drop in real examples, links, and view counts here.]
            </p>
            <div className="mt-7 rounded-2xl bg-background/10 ring-1 ring-background/15 p-5">
              <div className="text-[11px] uppercase tracking-widest text-brand font-semibold mb-1.5">
                How the crew thinks
              </div>
              <p className="text-sm text-background/85 leading-relaxed">
                Spot what&apos;s working. Rebuild it your way. Sound like nobody but you. Your crew handles all three in one place.
              </p>
            </div>
          </div>

          {/* Placeholder thumbnail grid */}
          <div className="grid grid-cols-2 gap-3">
            {THUMBS.map((t) => (
              <div
                key={t.label}
                className="rounded-2xl bg-background/[0.07] ring-1 ring-background/10 overflow-hidden"
              >
                <div className="aspect-video grid place-items-center bg-background/[0.04]">
                  <Play className="size-6 text-background/30 fill-current" />
                </div>
                <div className="p-3">
                  <div className="text-[11px] text-background/60 truncate">{t.label}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-medium text-background/85">{t.views}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand text-brand-foreground">
                      <TrendingUp className="size-2.5" />
                      {t.mult}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
