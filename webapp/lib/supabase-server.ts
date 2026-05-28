/**
 * Server-side Supabase client that uses the cookie-based session set by
 * @supabase/ssr. Use this from server components, route handlers, and
 * server actions to:
 *   - read the currently authenticated user (`supabase.auth.getUser()`)
 *   - exchange OAuth/magic-link codes for a session
 *
 * For database queries that need to bypass RLS (sync jobs, ingest,
 * enrichment), keep using `getSupabase()` from `./supabase.ts` — that one
 * uses the service role key.
 */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // setAll throws when called from a Server Component (cookies()
          // is read-only there). That's fine — sessions get refreshed by
          // the proxy/middleware instead.
        }
      },
    },
  });
}
