"use client";

// Placeholder creator avatars — swap these for real <Image> tiles later.
// One copy must be wide enough to span the viewport, else the -50% loop
// exposes a gap before it wraps. The track below renders two copies.
const AVATARS = Array.from({ length: 16 }, (_, i) => i);

export function SocialProof() {
  return (
    <section className="py-14 px-6 border-y border-border bg-card/40">
      <div className="max-w-7xl mx-auto">
        <p className="text-center text-[11px] font-medium tracking-[0.2em] uppercase text-muted-foreground mb-8">
          Trusted by creators
        </p>
        {/* Auto-scrolling marquee. The track holds two identical copies of the
            list; the -50% translate loops seamlessly. Edge masks fade it out,
            and hovering pauses the scroll. */}
        <div
          className="marquee-pause relative overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          }}
        >
          <div className="marquee-track flex w-max shrink-0 items-center gap-x-10">
            {[...AVATARS, ...AVATARS].map((_, i) => (
              <div
                key={i}
                aria-hidden
                className="size-14 shrink-0 rounded-full bg-muted-foreground/15 ring-1 ring-border"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
