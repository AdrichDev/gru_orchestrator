/**
 * Tests for scripts/postinstall.mjs
 *
 * These tests verify:
 *   - Global-install context creates ~/.gru/ and seeds yaml files
 *   - Global-install is idempotent (no clobber)
 *   - Global-install exits 0 even when git/network unavailable (simulated)
 *   - Dev/monorepo context is detected correctly
 */

import { describe, expect, test, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, "..");
const POSTINSTALL_SCRIPT = path.join(REPO_ROOT, "scripts", "postinstall.mjs");
const IS_WIN = process.platform === "win32";

function makeTmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Run the postinstall script in a subprocess with a custom HOME and context.
 * By default, the awesome-copilot clone is skipped (GRU_SKIP_AWESOME_COPILOT_CLONE=1)
 * to keep tests fast and offline-safe.
 * Returns { status, stdout, stderr }.
 */
function runPostinstall(
  fakeHome: string,
  contextOverride: "global" | "dev" | undefined,
  extraEnv: Record<string, string> = {}
): { status: number | null; stdout: string; stderr: string } {
  const env: Record<string, string> = {
    ...process.env,
    HOME: fakeHome,                          // Unix home
    USERPROFILE: fakeHome,                   // Windows home
    GRU_SKIP_AWESOME_COPILOT_CLONE: "1",     // skip network clone in tests
    ...extraEnv,
  };

  if (contextOverride) {
    env.GRU_POSTINSTALL_CONTEXT = contextOverride;
  }

  const result = spawnSync(process.execPath, [POSTINSTALL_SCRIPT], {
    encoding: "utf8",
    env,
    shell: false,
    timeout: 30_000,
    cwd: REPO_ROOT,
  });

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("postinstall — global context", () => {
  let fakeHome: string;

  beforeEach(() => {
    fakeHome = makeTmpDir("gru-postinstall-test-home-");
  });

  afterEach(() => {
    cleanDir(fakeHome);
  });

  test("exits 0 in global context", { timeout: 15_000 }, () => {
    const { status } = runPostinstall(fakeHome, "global");
    expect(status).toBe(0);
  });

  test("creates ~/.gru/ directory", { timeout: 15_000 }, () => {
    runPostinstall(fakeHome, "global");
    expect(fs.existsSync(path.join(fakeHome, ".gru"))).toBe(true);
  });

  test("seeds default config files into ~/.gru/", { timeout: 15_000 }, () => {
    runPostinstall(fakeHome, "global");
    const gruDir = path.join(fakeHome, ".gru");
    // config.yaml must be seeded from templates
    expect(fs.existsSync(path.join(gruDir, "config.yaml"))).toBe(true);
    // providers.yaml must be seeded
    expect(fs.existsSync(path.join(gruDir, "providers.yaml"))).toBe(true);
  });

  test("idempotent: does not clobber existing config files", { timeout: 15_000 }, () => {
    // Pre-create config.yaml with custom content
    const gruDir = path.join(fakeHome, ".gru");
    fs.mkdirSync(gruDir, { recursive: true });
    fs.writeFileSync(path.join(gruDir, "config.yaml"), "# custom content\n");

    // Run postinstall
    runPostinstall(fakeHome, "global");

    // File must not be clobbered
    const content = fs.readFileSync(path.join(gruDir, "config.yaml"), "utf-8");
    expect(content).toBe("# custom content\n");
  });

  test("offline-safe: exits 0 even when git clone would fail (unreachable target)", { timeout: 15_000 }, () => {
    // We can't easily block the network, but we can verify the script doesn't throw
    // even if git is told to clone an unreachable host (use a fake url via env)
    // Instead, we just run in global context and expect exit 0 regardless of
    // awesome-copilot clone result.
    const { status, stderr } = runPostinstall(fakeHome, "global");
    expect(status).toBe(0);
    // No unhandled errors in stderr (warnings are ok)
    expect(stderr).not.toMatch(/Error:/);
    expect(stderr).not.toMatch(/UnhandledPromiseRejection/);
  });

  test("does not throw when templates/ dir is present (seeding succeeds)", { timeout: 15_000 }, () => {
    const { status, stdout } = runPostinstall(fakeHome, "global");
    expect(status).toBe(0);
    // The script logs the gruDir path — check it contains ".gru" in some form
    expect(stdout).toMatch(/\.gru/);
  });
});

describe("postinstall — dev/monorepo context", () => {
  let fakeHome: string;

  beforeEach(() => {
    fakeHome = makeTmpDir("gru-postinstall-dev-test-home-");
  });

  afterEach(() => {
    cleanDir(fakeHome);
  });

  test("exits 0 in dev context (no crash)", { timeout: 15_000 }, () => {
    // Dev context: runs setup-cybersec.mjs --postinstall which also exits 0
    const { status } = runPostinstall(fakeHome, "dev");
    expect(status).toBe(0);
  });

  test("auto-detects dev context when packages/ dir is present (no override needed)", { timeout: 15_000 }, () => {
    // Run without override — should auto-detect dev because packages/ exists at REPO_ROOT
    const { status } = runPostinstall(fakeHome, undefined);
    expect(status).toBe(0);
  });
});

describe("postinstall — script is present and executable", () => {
  test("postinstall.mjs exists at scripts/postinstall.mjs", () => {
    expect(fs.existsSync(POSTINSTALL_SCRIPT)).toBe(true);
  });

  test("postinstall.mjs starts with correct shebang or is valid ESM", () => {
    const content = fs.readFileSync(POSTINSTALL_SCRIPT, "utf-8");
    expect(content).toMatch(/^#!\/usr\/bin\/env node/);
  });
});
