"use client";

import { Play } from "lucide-react";

// PLACEHOLDER section. Replace the bracketed headline, quote, name, and the
// dummy thumbnails with a real user story before treating this as proof.
export function Testimonial() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto text-center">
        <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-brand">
          In their words [placeholder]
        </span>
        <h2 className="font-display text-3xl md:text-5xl font-semibold leading-tight mt-3 mb-5 text-balance">
          [The post they almost skipped did XXXk.]
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed text-pretty">
          [Placeholder: a short story of a real creator who let their crew pick the idea, shaped it their way, and watched it land. Swap in the real details.]
        </p>

        <figure className="mt-10 max-w-2xl mx-auto">
          <blockquote className="font-display text-xl md:text-2xl font-medium leading-snug text-balance">
            &ldquo;[Drop a real testimonial quote here. Keep it specific and in the creator&apos;s own words.]&rdquo;
          </blockquote>
          <figcaption className="mt-5 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            [Name, @handle]
          </figcaption>
        </figure>

        {/* Placeholder proof thumbnails */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
          {["[XXk views]", "[XXXk views]", "[XXk views]"].map((v, i) => (
            <div key={i} className="rounded-2xl bg-secondary ring-1 ring-border overflow-hidden">
              <div className="aspect-video grid place-items-center">
                <Play className="size-5 text-muted-foreground/40 fill-current" />
              </div>
              <div className="p-2.5 text-[11px] text-muted-foreground border-t border-border">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
