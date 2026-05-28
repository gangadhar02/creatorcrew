/**
 * Browser-side Supabase client. Used from "use client" components to
 * trigger magic-link sign-in and read the current session from cookies.
 *
 * NEVER call any database query directly through this client — RLS
 * policies expect every read/write to come through the server, where we
 * still use the service role key.
 */
"use client";

import { createBrowserClient } from "@supabase/ssr";

let cached: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (cached) return cached;
  cached = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return cached;
}
