/**
 * Instagram session cookies — two accounts:
 *
 *   personal  → SaveSync (Python sync.py). Uses ig_session_id / ig_csrftoken /
 *               ig_user_id in config.json. Never used for heavy scraping.
 *
 *   scraping  → Profile Analyzer, creator ingest, semantic IG search, transcribe/
 *               vision on creator posts. Uses ig_scrape_* in config.json (or
 *               IG_SCRAPE_* env vars). Keeps ban risk off your main account.
 *
 * Server-only. Do not import from a "use client" file.
 */
import fs from "node:fs";
import path from "node:path";

export type IGAccount = "personal" | "scraping";

export type IGCookies = {
  sessionId: string;
  csrfToken: string;
  userId: string;
  /** Which cookie set was actually loaded (may differ when scraping falls back). */
  source: IGAccount;
};

type ConfigJson = {
  ig_session_id?: string;
  ig_csrftoken?: string;
  ig_user_id?: string | number;
  ig_scrape_session_id?: string;
  ig_scrape_csrftoken?: string;
  ig_scrape_user_id?: string | number;
};

const TTL_MS = 30_000;
const cache: Partial<
  Record<IGAccount, { cookies: IGCookies; loadedAt: number }>
> = {};

function configPath(): string | null {
  const projectDir = process.env.PYTHON_PROJECT_DIR;
  if (!projectDir) return null;
  return path.join(projectDir, "config.json");
}

/**
 * Read config.json if it exists. Returns an empty object on cloud hosts
 * (Vercel etc.) where the file isn't present — callers should fall back
 * to env-var cookies in that case.
 */
function readConfigFile(): ConfigJson {
  const p = configPath();
  if (!p) return {};
  try {
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw) as ConfigJson;
  } catch {
    return {};
  }
}

function toCookies(
  sessionId: string,
  csrfToken: string,
  userId: string | number,
  source: IGAccount
): IGCookies {
  return {
    sessionId,
    csrfToken,
    userId: String(userId),
    source,
  };
}

function readPersonalCookies(cfg: ConfigJson): IGCookies {
  if (!cfg.ig_session_id || !cfg.ig_csrftoken || !cfg.ig_user_id) {
    throw new Error(
      "ig_session_id / ig_csrftoken / ig_user_id missing in config.json (personal / SaveSync account)"
    );
  }
  return toCookies(
    cfg.ig_session_id,
    cfg.ig_csrftoken,
    cfg.ig_user_id,
    "personal"
  );
}

function readScrapeCookiesFromEnv(): IGCookies | null {
  const sessionId = process.env.IG_SCRAPE_SESSION_ID?.trim();
  const csrfToken = process.env.IG_SCRAPE_CSRFTOKEN?.trim();
  const userId = process.env.IG_SCRAPE_USER_ID?.trim();
  if (sessionId && csrfToken && userId) {
    return toCookies(sessionId, csrfToken, userId, "scraping");
  }
  return null;
}

function readPersonalCookiesFromEnv(): IGCookies | null {
  const sessionId = process.env.IG_SESSION_ID?.trim();
  const csrfToken = process.env.IG_CSRFTOKEN?.trim();
  const userId = process.env.IG_USER_ID?.trim();
  if (sessionId && csrfToken && userId) {
    return toCookies(sessionId, csrfToken, userId, "personal");
  }
  return null;
}

function readScrapeCookiesFromConfig(cfg: ConfigJson): IGCookies | null {
  if (
    cfg.ig_scrape_session_id &&
    cfg.ig_scrape_csrftoken &&
    cfg.ig_scrape_user_id
  ) {
    return toCookies(
      cfg.ig_scrape_session_id,
      cfg.ig_scrape_csrftoken,
      cfg.ig_scrape_user_id,
      "scraping"
    );
  }
  return null;
}

/** True when a dedicated scraping/dummy account is configured. */
export function isScrapeAccountConfigured(): boolean {
  if (readScrapeCookiesFromEnv()) return true;
  const cfg = readConfigFile();
  return !!readScrapeCookiesFromConfig(cfg);
}

function readCookiesForAccount(account: IGAccount): IGCookies {
  // Env-var path — works on Vercel, GitHub Actions, any cloud host.
  // Tried FIRST so production never tries to open a local config.json
  // that doesn't exist on the deploy.
  if (account === "personal") {
    const fromEnv = readPersonalCookiesFromEnv();
    if (fromEnv) return fromEnv;
  } else {
    const fromEnv = readScrapeCookiesFromEnv();
    if (fromEnv) return fromEnv;
  }

  // File-based fallback — only useful for local Mac dev where config.json
  // exists at PYTHON_PROJECT_DIR.
  const cfg = readConfigFile();

  if (account === "personal") {
    if (!cfg.ig_session_id || !cfg.ig_csrftoken || !cfg.ig_user_id) {
      throw new Error(
        "IG personal cookies not configured. Set IG_SESSION_ID / IG_CSRFTOKEN / IG_USER_ID in env, or fill in config.json for local dev."
      );
    }
    return readPersonalCookies(cfg);
  }

  // Scraping: env miss, try config file, then fall back to personal.
  const fromCfg = readScrapeCookiesFromConfig(cfg);
  if (fromCfg) return fromCfg;

  if (!cfg.ig_session_id || !cfg.ig_csrftoken || !cfg.ig_user_id) {
    throw new Error(
      "IG scrape cookies not configured. Set IG_SCRAPE_SESSION_ID / IG_SCRAPE_CSRFTOKEN / IG_SCRAPE_USER_ID in env, or add ig_scrape_* to config.json for local dev."
    );
  }
  console.warn(
    "[ig-config] ig_scrape_* not set — scraping will fall back to personal SaveSync cookies. " +
      "Add a dummy account (IG_SCRAPE_* env vars or ig_scrape_* in config.json)."
  );
  return readPersonalCookies(cfg);
}

export function getIGCookies(account: IGAccount = "scraping"): IGCookies {
  const now = Date.now();
  const hit = cache[account];
  if (hit && now - hit.loadedAt < TTL_MS) {
    return hit.cookies;
  }
  const cookies = readCookiesForAccount(account);
  cache[account] = { cookies, loadedAt: now };
  return cookies;
}

/** Human-readable hint when a session expires. */
export function igCookieRefreshHint(account: IGAccount): string {
  if (account === "personal") {
    return "Refresh personal cookies (ig_session_id, ig_csrftoken, ig_user_id) in config.json — used by SaveSync.";
  }
  if (isScrapeAccountConfigured()) {
    return "Refresh scraping cookies (ig_scrape_* in config.json or IG_SCRAPE_* in .env.local).";
  }
  return "Refresh ig_scrape_* in config.json (dummy account), or ig_* for personal SaveSync.";
}
