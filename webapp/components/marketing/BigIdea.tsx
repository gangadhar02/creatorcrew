"use client";

import { TrendingUp, Brain, Lightbulb, PenLine, ArrowRight } from "lucide-react";

const steps = [
  { icon: TrendingUp, label: "Track" },
  { icon: Brain, label: "Learn" },
  { icon: Lightbulb, label: "Ideate" },
  { icon: PenLine, label: "Write" },
];

export function BigIdea() {
  return (
    <section className="py-24 px-6 bg-foreground text-background relative overflow-hidden">
      <div className="absolute inset-0 dot-grid text-background opacity-10 pointer-events-none" />
      <div className="relative max-w-5xl mx-auto text-center">
        <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-brand">The big idea</span>
        <h2 className="font-display text-4xl md:text-6xl font-semibold leading-[1.05] mt-4 mb-8 text-balance">
          Not a tool. A crew that works while you create.
        </h2>
        <p className="text-lg text-background/70 max-w-2xl mx-auto mb-14">
          Not another analytics dashboard. Not another generic chatbot. A crew of AI agents that knows your niche, your voice, and what <em className="not-italic text-brand">you</em> make.
        </p>

        <div className="flex items-center justify-center gap-2 md:gap-4 flex-wrap">
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2 md:gap-4">
              <div className="flex items-center gap-3 rounded-2xl border border-background/15 bg-background/5 px-4 py-3 md:px-5 md:py-3.5">
                <span className="grid place-items-center size-8 rounded-lg bg-brand text-brand-foreground">
                  <s.icon className="size-4" />
                </span>
                <span className="font-display text-base md:text-lg font-semibold">{s.label}</span>
              </div>
              {i < steps.length - 1 && <ArrowRight className="size-4 text-background/40" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}