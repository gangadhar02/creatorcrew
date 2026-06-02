"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { q: "What is CreatorCrew?", a: "Your AI creative second brain — it turns saved inspiration into finished content in your voice." },
  { q: "How does it know my voice?", a: "CreatorCrew analyzes your past content and lets you capture your writing style, then generates ideas and drafts that sound like you." },
  { q: "Do I need to give my Instagram password?", a: "No. You connect or import your saves; we never ask for risky credentials." },
  { q: "Which platforms does it support?", a: "Instagram today. More platforms are coming — start with CreatorCrew and we'll grow with you." },
  { q: "Is there a free plan?", a: "Yes — start free with no credit card. Upgrade when you're ready to ship daily." },
  { q: "Can it write posts for me?", a: "It ideates and drafts in your voice; you always stay in control of the final post." },
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
