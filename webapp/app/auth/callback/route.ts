/**
 * GET /auth/callback — exchanges the magic-link OTP code in the URL for
 * a session cookie, then redirects to the intended page (or /).
 *
 * Supabase appends `?code=<otp>` (or `?token_hash=...&type=email` for the
 * older flow) when the user clicks the email link.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") || "/";

  const supabase = await getSupabaseServerClient();

  // Newer PKCE flow — exchange the auth code for a session.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
      );
    }
    return NextResponse.redirect(new URL(next, request.url));
  }

  // Legacy hashed token flow — used by some Supabase email templates.
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "email" | "magiclink" | "recovery" | "invite",
      token_hash: tokenHash,
    });
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
      );
    }
    return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(
    new URL("/login?error=Invalid+or+expired+sign-in+link", request.url)
  );
}
