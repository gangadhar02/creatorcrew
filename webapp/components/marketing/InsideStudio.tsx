"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DiscoverMockup, VisionMockup, VoiceMockup } from "./FeatureMockups";

type Step = { n: string; title: string; body: string; link: string; visual: ReactNode };

const STEPS: Step[] = [
  {
    n: "01",
    title: "Spot what's working.",
    body: "Your crew watches high-performing posts, reels, and video in your niche across every platform, then surfaces the hooks and formats already earning attention, before you make a thing.",
    link: "See what's trending",
    visual: <DiscoverMockup />,
  },
  {
    n: "02",
    title: "Make it yours.",
    body: "Break any post down to its bones, the hook, the turns, the payoff, then rebuild that shape around your own idea. Borrow the structure, never the words.",
    link: "Break down a post",
    visual: <VisionMockup />,
  },
  {
    n: "03",
    title: "Sound like you.",
    body: "Your crew studies your best work and writes in that voice. Every draft and reply lands like you wrote it, not like a model took a guess.",
    link: "Teach it your voice",
    visual: <VoiceMockup />,
  },
];

export function InsideStudio() {
  const [active, setActive] = useState(0);

  return (
    <section id="how" className="py-24 px-6">
      <div className="max-w-3xl mx-auto text-center mb-16">
        <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-brand">How the crew works</span>
        <h2 className="font-display text-3xl md:text-5xl font-semibold leading-tight mt-3 text-balance">
          The three moves behind every post that lands.
        </h2>
        <p className="text-muted-foreground mt-4 text-pretty">
          Most creators already know these steps. What they&apos;re missing is something to keep them on track. That something is your crew.
        </p>
      </div>

      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
        {/* Step accordion */}
        <div className="space-y-3">
          {STEPS.map((step, i) => {
            const open = i === active;
            return (
              <button
                key={step.n}
                type="button"
                onClick={() => setActive(i)}
                aria-expanded={open}
                className={cn(
                  "w-full text-left rounded-2xl border p-5 transition-colors",
                  open ? "border-brand/40 bg-card shadow-sm" : "border-border bg-transparent hover:bg-card/60",
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "text-[11px] font-bold tracking-widest",
                      open ? "text-brand" : "text-muted-foreground",
                    )}
                  >
                    STEP {step.n}
                  </span>
                  <span className="font-display text-lg md:text-xl font-semibold">{step.title}</span>
                </div>
                {open && (
                  <div className="mt-3">
                    <p className="text-sm md:text-base text-muted-foreground leading-relaxed text-pretty">{step.body}</p>
                    <span className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-brand">
                      {step.link}
                      <ArrowRight className="size-4" />
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Visual swaps with the active step */}
        <div className="md:sticky md:top-24">{STEPS[active].visual}</div>
      </div>
    </section>
  );
}
