import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  // Throwing here surfaces config issues early in any server context.
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env"
  );
}

/**
 * Server-side Supabase client using the service_role key.
 * Use ONLY from server components, route handlers, and server actions.
 * Never import into a "use client" file.
 *
 * Note: we don't pass the Database generic — supabase-js's strict typing
 * was making `.maybeSingle()` collapse to `never` for some tables. Instead
 * we cast at call sites where we need typed access.
 */
export function getSupabase() {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
