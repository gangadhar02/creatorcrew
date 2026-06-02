"use client";

import { Plug, Brain, PenLine } from "lucide-react";

const steps = [
  { icon: Plug, title: "Connect & save", body: "Import your Instagram saves and bookmarks, or save any post into Drafts." },
  { icon: Brain, title: "Let AI learn your taste", body: "It analyzes your content, captures your voice, and surfaces what performs." },
  { icon: PenLine, title: "Create", body: "Ideate, plan on the canvas, and write your next post — in your voice — with your AI copilot." },
];

export function HowItWorks() {
  return (
    <section id="how" className="py-24 px-6 bg-card/40 border-y border-border">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-brand">How it works</span>
          <h2 className="font-display text-3xl md:text-5xl font-semibold leading-tight mt-3 text-balance">
            Three steps from save to post.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl bg-card ring-1 ring-border p-7">
              <div className="flex items-center justify-between mb-6">
                <span className="grid place-items-center size-12 rounded-xl bg-brand/10 text-brand">
                  <s.icon className="size-5" />
                </span>
                <span className="font-display text-5xl font-semibold text-foreground/10">0{i + 1}</span>
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}