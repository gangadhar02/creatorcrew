import { NextResponse } from "next/server";
import { spawn } from "node:child_process";

/**
 * POST /api/sync
 * Spawns the Python sync.py script in detached mode and returns immediately.
 * Progress is observable via the dashboard's sync_runs table (sync.py writes
 * a row at start, updates at end).
 */
export async function POST() {
  const projectDir = process.env.PYTHON_PROJECT_DIR;
  const pythonBin = process.env.PYTHON_BIN;

  if (!projectDir || !pythonBin) {
    return NextResponse.json(
      { error: "PYTHON_PROJECT_DIR or PYTHON_BIN not configured" },
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
      pid: child.pid,
      message: "Sync started in background. Check the dashboard for status.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
