/**
 * Next.js 16 Proxy (formerly Middleware) — runs before every page request.
 *
 * Responsibilities:
 *   1. Hostname routing for the production domains:
 *        • {root}            (creatorcrew.app)         → marketing landing only
 *        • studio.{root}     (studio.creatorcrew.app)  → the web app
 *        • www.{root}        → 308 to the bare root
 *        • app.{root}        → 308 to studio (catch people who guess "app")
 *      Non-production hosts (localhost, *.vercel.app previews) keep the
 *      combined single-domain behavior: "/" is the landing, the app lives at
 *      /home, /bookmarks, etc. — so local dev + preview deploys still work.
 *   2. Refresh the Supabase auth session cookie on every request. On the real
 *      domain the cookie is scoped to ".{root}" so a session is shared between
 *      the landing and studio subdomain.
 *   3. Redirect unauthenticated users to /login (with a `next=` hint).
 *
 * Set NEXT_PUBLIC_ROOT_DOMAIN in Vercel to your apex (default: creatorcrew.app).
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATH_PREFIXES = ["/login", "/auth"];

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "creatorcrew.app";
const STUDIO_HOST = `studio.${ROOT_DOMAIN}`;

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // API routes enforce their own auth; never redirect JSON consumers.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next({ request });
  }

  // Defensive: route stray Supabase magic-link codes to the callback handler.
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  if ((code || tokenHash) && pathname !== "/auth/callback") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  // --- Host classification -------------------------------------------------
  const host = (request.headers.get("host") || "").toLowerCase().split(":")[0];
  const isProdDomain = host === ROOT_DOMAIN || host.endsWith(`.${ROOT_DOMAIN}`);
  const isStudio = host === STUDIO_HOST;
  // The marketing landing renders here when we're NOT on the studio app host
  // (i.e. the bare prod root, or any non-prod host like localhost / previews).
  const landingIsHere = !isStudio;
  const isMarketing = isProdDomain && !isStudio;

  // Canonical-host redirects (prod only).
  if (isProdDomain) {
    if (host === `www.${ROOT_DOMAIN}`) {
      const url = request.nextUrl.clone();
      url.protocol = "https:";
      url.host = ROOT_DOMAIN;
      url.port = "";
      return NextResponse.redirect(url, 308);
    }
    if (host === `app.${ROOT_DOMAIN}`) {
      const url = request.nextUrl.clone();
      url.protocol = "https:";
      url.host = STUDIO_HOST;
      url.port = "";
      return NextResponse.redirect(url, 308);
    }
  }

  // On the bare marketing host, only "/" lives here — every app/auth path
  // belongs to the studio subdomain.
  if (isMarketing && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = STUDIO_HOST;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  // --- Auth session --------------------------------------------------------
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
            // Share the session across {root} + studio.{root} in production.
            const opts = isProdDomain
              ? { ...options, domain: `.${ROOT_DOMAIN}` }
              : options;
            response.cookies.set(name, value, opts);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // On the studio app host, "/" is NOT the landing — send it to the app home.
  if (isStudio && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  // Where the landing renders ("/"), bounce logged-in users to the app home.
  if (user && pathname === "/" && landingIsHere) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  const isPublic =
    (pathname === "/" && landingIsHere) ||
    PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));

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
