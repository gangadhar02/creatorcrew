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

function configPath(): string {
  const projectDir = process.env.PYTHON_PROJECT_DIR;
  if (!projectDir) {
    throw new Error("PYTHON_PROJECT_DIR not set in .env.local");
  }
  return path.join(projectDir, "config.json");
}

function readConfigFile(): ConfigJson {
  const raw = fs.readFileSync(configPath(), "utf-8");
  return JSON.parse(raw) as ConfigJson;
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
  try {
    if (readScrapeCookiesFromEnv()) return true;
    const cfg = readConfigFile();
    return !!readScrapeCookiesFromConfig(cfg);
  } catch {
    return false;
  }
}

function readCookiesForAccount(account: IGAccount): IGCookies {
  const cfg = readConfigFile();

  if (account === "personal") {
    return readPersonalCookies(cfg);
  }

  const fromEnv = readScrapeCookiesFromEnv();
  if (fromEnv) return fromEnv;

  const fromCfg = readScrapeCookiesFromConfig(cfg);
  if (fromCfg) return fromCfg;

  console.warn(
    "[ig-config] ig_scrape_* not set — scraping will use your personal SaveSync cookies. " +
      "Add a dummy account (ig_scrape_session_id / ig_scrape_csrftoken / ig_scrape_user_id) to config.json."
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
