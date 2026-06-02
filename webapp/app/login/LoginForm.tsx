"use client";

import { useState } from "react";
import { Mail, Lock, Loader2, KeyRound, ArrowLeft } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Mode = "code" | "password";

const inputClass =
  "w-full rounded-xl bg-card px-4 py-2.5 text-sm text-foreground outline-none ring-1 ring-border transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-brand";

const primaryBtnClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground transition-transform hover:brightness-110 active:scale-[0.99] disabled:opacity-60 disabled:active:scale-100";

export default function LoginForm({
  next,
  initialError,
  initialEmail,
}: {
  next?: string;
  initialError?: string;
  initialEmail?: string;
}) {
  const [mode, setMode] = useState<Mode>("code");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setPending(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setCode("");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    const token = code.trim();
    if (!token) return;
    setPending(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "email",
      });
      if (error) throw error;
      // Session cookie is now set — hard-navigate so server components
      // re-render with the new auth state (proxy refreshes on next req).
      window.location.href = next || "/home";
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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

  // Step 2 of the code flow — enter the 6-digit code we just emailed.
  if (sent) {
    return (
      <form onSubmit={handleVerifyCode} className="space-y-4 animate-page-in">
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setCode("");
            setError(null);
          }}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </button>
        <div className="space-y-1">
          <p className="font-medium">Enter your code</p>
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to <strong>{email}</strong>.
          </p>
        </div>
        <input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="Verification code"
          required
          autoFocus
          placeholder="123456"
          maxLength={6}
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          className={`${inputClass} text-center text-lg tracking-[0.5em]`}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={pending || code.length < 6}
          className={primaryBtnClass}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <KeyRound className="size-4" />
          )}
          Verify &amp; continue
        </button>
        <p className="text-center text-xs text-muted-foreground">
          Didn&apos;t get it?{" "}
          <button
            type="button"
            disabled={pending}
            onClick={(e) => handleSendCode(e)}
            className="font-medium text-foreground underline-offset-2 hover:underline disabled:opacity-50"
          >
            Resend code
          </button>
        </p>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-xs">
        <button
          type="button"
          onClick={() => {
            setMode("code");
            setError(null);
          }}
          className={`rounded-lg px-3 py-2 font-medium transition-colors ${
            mode === "code"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Email code
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("password");
            setError(null);
          }}
          className={`rounded-lg px-3 py-2 font-medium transition-colors ${
            mode === "password"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Password
        </button>
      </div>

      {mode === "code" ? (
        <form onSubmit={handleSendCode} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="you@yourdomain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={pending || !email}
            className={primaryBtnClass}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Mail className="size-4" />
            )}
            Get started
          </button>
          <p className="text-center text-[11px] text-muted-foreground">
            No password required. We&apos;ll email you a 6-digit sign-in code.
          </p>
        </form>
      ) : (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email-pw" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email-pw"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="you@yourdomain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={pending || !email || !password}
            className={primaryBtnClass}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Lock className="size-4" />
            )}
            Sign in
          </button>
          <p className="text-center text-[11px] text-muted-foreground">
            First time? Use{" "}
            <button
              type="button"
              onClick={() => {
                setMode("code");
                setError(null);
              }}
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              email code
            </button>{" "}
            to set up your account, then set a password in Settings.
          </p>
        </form>
      )}
    </div>
  );
}
