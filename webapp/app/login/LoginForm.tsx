"use client";

import { useState } from "react";
import { Mail, Lock, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Mode = "code" | "password";

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

  if (sent) {
    return (
      <form onSubmit={handleVerifyCode} className="space-y-4 animate-page-in">
        <div className="space-y-1 text-center">
          <p className="font-medium">Enter your code</p>
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to <strong>{email}</strong>. Enter it below to
            continue.
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="code" className="text-sm font-medium">
            Verification code
          </label>
          <Input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            autoFocus
            placeholder="123456"
            maxLength={6}
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            className="text-center tracking-[0.5em] text-lg"
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button
          type="submit"
          disabled={pending || code.length < 6}
          className="w-full"
        >
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="mr-2 h-4 w-4" />
          )}
          Verify & continue
        </Button>
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <button
            type="button"
            disabled={pending}
            onClick={(e) => handleSendCode(e)}
            className="hover:text-foreground underline-offset-2 hover:underline disabled:opacity-50"
          >
            Resend code
          </button>
          <span aria-hidden>·</span>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setCode("");
              setError(null);
            }}
            className="hover:text-foreground underline-offset-2 hover:underline"
          >
            Use a different email
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1 text-xs">
        <button
          type="button"
          onClick={() => {
            setMode("code");
            setError(null);
          }}
          className={`rounded px-3 py-1.5 font-medium transition-colors ${
            mode === "code"
              ? "bg-card shadow-sm text-foreground"
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
          className={`rounded px-3 py-1.5 font-medium transition-colors ${
            mode === "password"
              ? "bg-card shadow-sm text-foreground"
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
            Send code
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            No password required. We&apos;ll email you a 6-digit sign-in code.
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
                setMode("code");
                setError(null);
              }}
              className="underline hover:text-foreground"
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
