"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Variant = "light" | "dark";

export function EmailCaptureForm({
  variant = "light",
  cta = "Start free",
  className,
}: {
  variant?: Variant;
  cta?: string;
  className?: string;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value) || value.length > 255) {
      setError("Please enter a valid email");
      return;
    }
    try {
      const raw = localStorage.getItem("drafts_waitlist");
      const list: string[] = raw ? JSON.parse(raw) : [];
      if (!list.includes(value)) list.push(value);
      localStorage.setItem("drafts_waitlist", JSON.stringify(list));
    } catch {
      /* ignore storage errors */
    }
    setError(null);
    setSubmitted(true);
  }

  const isDark = variant === "dark";

  if (submitted) {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-3 max-w-md mx-auto rounded-2xl px-5 py-4 text-sm font-medium",
          isDark
            ? "bg-white/10 text-background ring-1 ring-white/15"
            : "bg-brand/10 text-foreground ring-1 ring-brand/20",
          className,
        )}
      >
        <span className="grid place-items-center size-6 rounded-full bg-brand text-brand-foreground">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
        You're on the list — we'll be in touch.
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn("max-w-md mx-auto w-full", className)}
      noValidate
    >
      <div
        className={cn(
          "flex gap-2 p-1.5 rounded-2xl ring-1 transition-colors",
          isDark
            ? "bg-white/10 ring-white/15 focus-within:ring-white/40"
            : "bg-card ring-border focus-within:ring-brand shadow-lg shadow-black/[0.03]",
        )}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          placeholder="you@yourdomain.com"
          aria-label="Email address"
          maxLength={255}
          className={cn(
            "flex-1 bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground",
            isDark && "text-background placeholder:text-background/50",
          )}
        />
        <button
          type="submit"
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-transform hover:brightness-110 active:scale-[0.98]"
        >
          {cta}
          <ArrowRight className="size-4" />
        </button>
      </div>
      {error && (
        <p className={cn("mt-2 text-xs", isDark ? "text-background/70" : "text-destructive")}>
          {error}
        </p>
      )}
    </form>
  );
}