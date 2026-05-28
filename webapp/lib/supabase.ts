import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the service_role key.
 * Use ONLY from server components, route handlers, and server actions.
 * Never import into a "use client" file.
 *
 * Env vars are checked at call time (not module load) so the Next.js
 * build phase can collect pages/route configs even before Vercel project
 * settings are wired up. If a request actually tries to use Supabase
 * without the keys set, it'll surface the same clear error — just at
 * runtime instead of at build.
 *
 * Note: we don't pass the Database generic — supabase-js's strict typing
 * was making `.maybeSingle()` collapse to `never` for some tables.
 * Cast at call sites where you need typed access.
 */
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env"
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
