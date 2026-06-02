"use client";

import { Fingerprint, Layers, LineChart, Heart } from "lucide-react";

const items = [
  { icon: Fingerprint, title: "Personalized to you", body: "Learns your taste and your voice, unlike generic AI tools." },
  { icon: Layers, title: "A whole crew, one workspace", body: "Trends, insight, ideas, and drafts in one place. No tool-hopping." },
  { icon: LineChart, title: "Built on real performance", body: "Outlier detection shows what actually works, not vanity averages." },
  { icon: Heart, title: "Made by a creator", body: "Born from a real content workflow, not a boardroom." },
];

export function Differentiators() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mb-14">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-brand">Why CreatorCrew</span>
          <h2 className="font-display text-3xl md:text-5xl font-semibold leading-tight mt-3 text-balance">
            Why creators pick CreatorCrew.
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {items.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl bg-card ring-1 ring-border p-7 hover:ring-brand/40 transition-all">
              <span className="grid place-items-center size-10 rounded-xl bg-brand/10 text-brand mb-5">
                <Icon className="size-5" />
              </span>
              <h3 className="font-display text-lg font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}