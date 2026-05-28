/**
 * X session cookies for bookmark fetch (personal account).
 *
 * Option A — individual values (DevTools → Application → Cookies → x.com):
 *   X_AUTH_TOKEN, X_CT0
 *
 * Option B — full Cookie header (DevTools → Network → Bookmarks request → Headers):
 *   X_COOKIE="auth_token=...; ct0=...; twid=...; ..."
 *
 * Server-only.
 */
import fs from "node:fs";
import path from "node:path";

export type XCookies = {
  authToken: string;
  ct0: string;
  /** Full cookie header sent to X (may include twid, guest_id, etc.). */
  cookieHeader: string;
};

function configPath(): string {
  const projectDir = process.env.PYTHON_PROJECT_DIR;
  if (!projectDir) return "";
  return path.join(projectDir, "config.json");
}

/** Parse `name=value` pairs from a Cookie header string. */
export function parseCookieString(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (name) out[name] = value;
  }
  return out;
}

function fromConfigFile(): XCookies | null {
  const p = configPath();
  if (!p || !fs.existsSync(p)) return null;
  const cfg = JSON.parse(fs.readFileSync(p, "utf-8")) as {
    x_auth_token?: string;
    x_ct0?: string;
    x_cookie?: string;
  };
  if (cfg.x_cookie?.trim()) {
    return cookiesFromRaw(cfg.x_cookie.trim());
  }
  if (cfg.x_auth_token && cfg.x_ct0) {
    return cookiesFromPair(cfg.x_auth_token, cfg.x_ct0);
  }
  return null;
}

function cookiesFromPair(authToken: string, ct0: string): XCookies {
  const auth = authToken.trim();
  const token = ct0.trim();
  return {
    authToken: auth,
    ct0: token,
    cookieHeader: `auth_token=${auth}; ct0=${token}`,
  };
}

function cookiesFromRaw(cookieHeader: string): XCookies {
  const parsed = parseCookieString(cookieHeader);
  const authToken = parsed.auth_token?.trim();
  const ct0 = parsed.ct0?.trim();
  if (!authToken || !ct0) {
    throw new Error(
      "X_COOKIE must include auth_token and ct0. Copy the full Cookie header from a logged-in Bookmarks request on x.com."
    );
  }
  return {
    authToken,
    ct0,
    cookieHeader: cookieHeader.trim(),
  };
}

export function xCookiesConfigured(): boolean {
  if (process.env.X_COOKIE?.trim()) return true;
  if (process.env.X_AUTH_TOKEN?.trim() && process.env.X_CT0?.trim()) return true;
  try {
    return !!fromConfigFile();
  } catch {
    return false;
  }
}

export function getXCookies(): XCookies {
  const rawCookie = process.env.X_COOKIE?.trim();
  if (rawCookie) return cookiesFromRaw(rawCookie);

  const fromEnv = process.env.X_AUTH_TOKEN?.trim();
  const ct0Env = process.env.X_CT0?.trim();
  if (fromEnv && ct0Env) return cookiesFromPair(fromEnv, ct0Env);

  const fromFile = fromConfigFile();
  if (fromFile) return fromFile;

  throw new Error(
    "X cookies not configured. Set X_AUTH_TOKEN + X_CT0, or X_COOKIE (full Cookie header from x.com Bookmarks network request)."
  );
}

export const X_GUEST_BEARER =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGTW5CJwZ4R1zxmHE";

export function xApiHeaders(cookies: XCookies): Record<string, string> {
  return {
    authorization: `Bearer ${X_GUEST_BEARER}`,
    cookie: cookies.cookieHeader,
    "x-csrf-token": cookies.ct0,
    "x-twitter-auth-type": "OAuth2Session",
    "x-twitter-active-user": "yes",
    "x-twitter-client-language": "en",
    accept: "*/*",
    referer: "https://x.com/i/bookmarks",
    origin: "https://x.com",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  };
}

/** Quick session check — returns @handle or an error message. */
export async function verifyXCookies(): Promise<{
  ok: boolean;
  screenName?: string;
  error?: string;
}> {
  try {
    const cookies = getXCookies();
    const res = await fetch(
      "https://x.com/i/api/1.1/account/settings.json",
      { headers: xApiHeaders(cookies), cache: "no-store" }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 401 || body.includes("code\":32")) {
        return {
          ok: false,
          error:
            "X rejected your cookies (expired or mismatched). While logged in on x.com, open DevTools → Network → reload Bookmarks → copy the full Cookie header into X_COOKIE in .env.local, then restart the server.",
        };
      }
      return {
        ok: false,
        error: `X session check HTTP ${res.status}: ${body.slice(0, 160)}`,
      };
    }
    const json = (await res.json()) as { screen_name?: string };
    return { ok: true, screenName: json.screen_name };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
