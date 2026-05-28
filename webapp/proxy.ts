/**
 * Next.js 16 Proxy (formerly Middleware) — runs before every page request.
 *
 * Two jobs:
 *   1. Refresh the Supabase auth session cookie on every request, so the
 *      token doesn't expire mid-session.
 *   2. Redirect unauthenticated users to /login (with a `next=` hint so
 *      they land back where they were going after sign-in).
 *
 * The `matcher` below excludes static assets, OG images, and Next.js
 * internals so the proxy never runs on those.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATH_PREFIXES = ["/login", "/auth"];

export async function proxy(request: NextRequest) {
  // Skip API routes — they enforce their own auth via getUser() and we
  // don't want to redirect JSON consumers to /login.
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/")) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // getUser() validates the JWT against Supabase and refreshes if needed.
  // Do NOT use getSession() here — that one trusts the cookie blindly.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Run on everything except static assets, image opt, favicons, and
    // the public folder. The proxy itself short-circuits /api/* above.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
