#!/usr/bin/env tsx
/**
 * scripts/apify-smoke-test.ts
 *
 * Verifies the Apify Instagram Scraper path end-to-end WITHOUT touching
 * Supabase. Reads APIFY_API_TOKEN from .env.local, fetches a target handle, runs
 * it through the same normalize/stat helpers the analyzer uses, and prints a
 * summary. Each run costs a few cents on Apify.
 *
 * Usage:
 *   npx tsx scripts/apify-smoke-test.ts <handle> [cap]
 *   npx tsx scripts/apify-smoke-test.ts nasa 12
 *
 * Requires in .env.local (or the shell env):
 *   APIFY_API_TOKEN   (APIFY_IG_ACTOR optional)
 */
import fs from "node:fs";
import path from "node:path";
import {
  fetchProfileAndPostsApify,
  isApifyConfigured,
} from "../lib/instagram-apify";
import {
  normalizePost,
  computeProfileStats,
  computeEngagementRate,
  computeOutlier,
} from "../lib/instagram";

/** Minimal .env.local loader (no dotenv dependency). Does not override vars
 *  already present in the shell env. */
function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();

  const handle = process.argv[2] || "nasa";
  const cap = Math.max(1, Math.min(parseInt(process.argv[3] || "12", 10), 200));

  if (!isApifyConfigured()) {
    console.error("✗ APIFY_API_TOKEN not set (.env.local or shell env).");
    process.exit(1);
  }

  console.log(`→ Apify Instagram Scraper: @${handle} (cap=${cap}) — this costs a few cents…\n`);
  try {
    const { profile, items } = await fetchProfileAndPostsApify(handle, cap);
    const normalized = items
      .map(normalizePost)
      .filter((p): p is NonNullable<typeof p> => p !== null);
    const stats = computeProfileStats(normalized);

    console.log("PROFILE");
    console.log(`  id            ${profile.id}`);
    console.log(`  username      ${profile.username}`);
    console.log(`  name          ${profile.full_name}`);
    console.log(`  followers     ${profile.follower_count.toLocaleString()}`);
    console.log(`  following     ${profile.following_count.toLocaleString()}`);
    console.log(`  media_count   ${profile.media_count}`);
    console.log(`  verified      ${profile.is_verified}`);
    console.log("");
    console.log(`POSTS (${normalized.length} fetched)`);
    console.log(
      `  typical_reel_views=${stats.typical_reel_views}  typical_post_likes=${stats.typical_post_likes}`
    );
    console.log("");
    for (const p of normalized.slice(0, 8)) {
      const snippet = (p.caption || "").replace(/\s+/g, " ").slice(0, 50);
      console.log(
        `  [${p.type}] ❤ ${p.like_count} 💬 ${p.comment_count} 👁 ${p.view_count} ` +
          `eng=${computeEngagementRate(p)} out=${computeOutlier(p, stats)}  ${snippet}`
      );
    }
    console.log("\n✓ Apify path OK. (view counts should be populated for reels.)");
    process.exit(0);
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
