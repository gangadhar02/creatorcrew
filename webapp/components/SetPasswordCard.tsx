"use client";

import { useState } from "react";
import { Lock, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * Set / change the password for the currently signed-in user.
 * Uses supabase.auth.updateUser({ password }), which requires an
 * active session (the user is on /settings, so they are signed in).
 */
export default function SetPasswordCard() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError(
        "Supabase rejects passwords shorter than 6 characters by default. Lower the minimum in Authentication → Policies if you really want something shorter."
      );
      return;
    }

    setPending(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. Use it next time you sign in.");
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Lock className="h-4 w-4" />
          Set / change password
        </div>
        <p className="text-xs text-muted-foreground">
          Optional. Lets you sign in with email + password instead of (or in
          addition to) the magic link.
        </p>
        <div className="grid gap-2">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            autoComplete="new-password"
          />
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm new password"
            autoComplete="new-password"
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button
          type="submit"
          size="sm"
          disabled={pending || !password || !confirm}
        >
          {pending ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
          )}
          Save password
        </Button>
      </form>
    </Card>
  );
}
