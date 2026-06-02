"use client";

import { useState } from "react";
import { Mail, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Mode = "magic" | "password";

export default function LoginForm({
  next,
  initialError,
}: {
  next?: string;
  initialError?: string;
}) {
  const [mode, setMode] = useState<Mode>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);

  async function handleMagicSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setPending(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const callbackUrl = `${window.location.origin}/auth/callback${
        next ? `?next=${encodeURIComponent(next)}` : ""
      }`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: callbackUrl },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setPending(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      // Session cookie is now set — hard-navigate so server components
      // re-render with the new auth state (proxy refreshes on next req).
      window.location.href = next || "/home";
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center space-y-3 animate-page-in">
        <CheckCircle2 className="mx-auto h-8 w-8 text-primary" />
        <div className="space-y-1">
          <p className="font-medium">Check your inbox</p>
          <p className="text-sm text-muted-foreground">
            We sent a sign-in link to <strong>{email}</strong>. Open it on this
            device to continue.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setEmail("");
          }}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1 text-xs">
        <button
          type="button"
          onClick={() => {
            setMode("magic");
            setError(null);
          }}
          className={`rounded px-3 py-1.5 font-medium transition-colors ${
            mode === "magic"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Magic link
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("password");
            setError(null);
          }}
          className={`rounded px-3 py-1.5 font-medium transition-colors ${
            mode === "password"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Password
        </button>
      </div>

      {mode === "magic" ? (
        <form onSubmit={handleMagicSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button
            type="submit"
            disabled={pending || !email}
            className="w-full"
          >
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            Send magic link
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            No password required. We&apos;ll email you a one-time sign-in link.
          </p>
        </form>
      ) : (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email-pw" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email-pw"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button
            type="submit"
            disabled={pending || !email || !password}
            className="w-full"
          >
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Lock className="mr-2 h-4 w-4" />
            )}
            Sign in
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            First time? Use{" "}
            <button
              type="button"
              onClick={() => {
                setMode("magic");
                setError(null);
              }}
              className="underline hover:text-foreground"
            >
              magic link
            </button>{" "}
            to set up your account, then set a password in Settings.
          </p>
        </form>
      )}
    </div>
  );
}
