"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { q: "What is CreatorCrew?", a: "Your AI second brain for content. A crew of AI agents that tracks your niche, learns your voice, and turns inspiration into finished posts in your tone." },
  { q: "How does it know my voice?", a: "Your crew analyzes your past content and lets you capture your writing style, then generates ideas and drafts that sound like you." },
  { q: "Do I need to give my Instagram password?", a: "No. You connect or import your saves, and we never ask for risky credentials." },
  { q: "Which platforms does it support?", a: "Instagram today. More platforms are coming, so start with CreatorCrew and we'll grow with you." },
  { q: "Is there a free plan?", a: "Yes. Start free with no credit card. Upgrade when you're ready to ship daily." },
  { q: "Can it write posts for me?", a: "Your crew ideates and drafts in your voice, and you always stay in control of the final post." },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-brand">FAQ</span>
          <h2 className="font-display text-3xl md:text-5xl font-semibold leading-tight mt-3 text-balance">
            Questions, answered.
          </h2>
        </div>
        <div className="rounded-2xl bg-card ring-1 ring-border px-6">
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <div
                key={it.q}
                className={cn(
                  "border-b border-border",
                  i === items.length - 1 && "border-b-0"
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 text-left font-display text-base md:text-lg font-semibold py-5"
                >
                  {it.q}
                  <ChevronDown
                    className={cn(
                      "size-5 shrink-0 text-muted-foreground transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>
                {isOpen && (
                  <p className="text-muted-foreground text-sm leading-relaxed pb-5 -mt-1">
                    {it.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
