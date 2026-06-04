import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { getWorkspaceContext } from "@/lib/workspace";

/**
 * POST /api/sync
 *
 * Triggers the Instagram saves sync.
 *
 *   QUEUED MODE (production / Vercel):
 *     Dispatches the `sync.yml` GitHub Actions workflow (workflow_dispatch) —
 *     the same workflow that runs when you trigger it manually from the Actions
 *     tab. Vercel can't run Python, so this is the only path that actually
 *     syncs in production. Requires a dispatch token (SYNC_DISPATCH_TOKEN or
 *     ANALYZER_DISPATCH_TOKEN) — a GitHub PAT with Actions write on this repo.
 *
 *   LOCAL MODE (dev fallback):
 *     When no dispatch token is set, spawns sync.py directly (needs
 *     PYTHON_PROJECT_DIR / PYTHON_BIN). Useful on the Mac dev box.
 *
 * Note: the sync.yml *cron* stays disabled (IG challenged the cookies). This
 * only powers the on-demand "Run Sync Now" button.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GITHUB_OWNER = process.env.GITHUB_REPO_OWNER || "gangadhar02";
const GITHUB_REPO = process.env.GITHUB_REPO_NAME || "creatorcrew";
const GITHUB_REF = process.env.GITHUB_REPO_REF || "main";
const WORKFLOW_FILE = "sync.yml";

export async function POST() {
  // Auth-gate: this triggers a GitHub Actions run / spawns a process, so it
  // must not be callable anonymously.
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token =
    process.env.SYNC_DISPATCH_TOKEN || process.env.ANALYZER_DISPATCH_TOKEN;

  // ── QUEUED MODE — dispatch the GitHub Actions workflow ──────────────────
  if (token) {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        // Empty inputs → workflow uses the COLLECTIONS_FILTER repo secret.
        body: JSON.stringify({ ref: GITHUB_REF, inputs: {} }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return NextResponse.json(
          {
            error: `GitHub workflow dispatch failed (${res.status}): ${errText.slice(0, 300)}`,
          },
          { status: 502 }
        );
      }
      return NextResponse.json({
        ok: true,
        mode: "queued",
        message: "Sync queued on GitHub Actions.",
        workflow_run_url: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}`,
      });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 502 });
    }
  }

  // ── LOCAL MODE — spawn sync.py (dev only) ───────────────────────────────
  const projectDir = process.env.PYTHON_PROJECT_DIR;
  const pythonBin = process.env.PYTHON_BIN;
  if (!projectDir || !pythonBin) {
    return NextResponse.json(
      {
        error:
          "Sync not wired up: set SYNC_DISPATCH_TOKEN (or ANALYZER_DISPATCH_TOKEN), a GitHub PAT with Actions write, to trigger the sync.yml workflow. For local dev, set PYTHON_PROJECT_DIR / PYTHON_BIN instead.",
      },
      { status: 500 }
    );
  }
  try {
    const child = spawn(pythonBin, ["sync.py"], {
      cwd: projectDir,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return NextResponse.json({
      ok: true,
      mode: "local",
      pid: child.pid,
      message: "Sync started locally. Check the dashboard for status.",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
