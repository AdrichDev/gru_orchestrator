#!/usr/bin/env node
/**
 * gru-harness — postinstall bootstrap.
 *
 * Runs automatically after `pnpm add -g gru-harness` (or npm/yarn global).
 * Also fires during `pnpm install` in the monorepo dev context.
 *
 * Contract:
 *   - NEVER throws or exits non-zero — must not break the install.
 *   - In dev/monorepo context: delegates to the existing dev setup scripts and exits.
 *   - In global-install context:
 *       1. Creates ~/.gru/ (idempotent).
 *       2. Seeds default config/providers/skills yaml from templates (no clobber).
 *       3. Optionally clones awesome-copilot into ~/.gru/awesome-copilot
 *          (skipped silently if git absent or network unavailable).
 *
 * Context detection:
 *   A dev/monorepo context is detected by the presence of the `packages/`
 *   directory next to the script (meaning we are running inside the source
 *   checkout, not from an installed package). The env var
 *   GRU_POSTINSTALL_CONTEXT=dev forces the dev path; =global forces the
 *   global path (useful for testing).
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPT_ROOT = resolve(__dirname, ".."); // repo root when in scripts/, or pkg root from dist/

const warn = (msg) => process.stderr.write(`[gru postinstall] WARN: ${msg}\n`);
const info = (msg) => process.stdout.write(`[gru postinstall] ${msg}\n`);

const GRU_BANNER = `
        .-"""""-.
       /         \\
      |  o     o  |
      |    | |    |       G R U   H A R N E S S
      |    | |    |    ─────────────────────────────
       \\   '-'   /      orchestrator · globally installable
        '-.___.-'       gru init → pick your runtime
`;

// ---------------------------------------------------------------------------
// Context detection
// ---------------------------------------------------------------------------

function isDevContext() {
  const envOverride = process.env.GRU_POSTINSTALL_CONTEXT;
  if (envOverride === "dev") return true;
  if (envOverride === "global") return false;

  // Heuristic: dev/monorepo checkout has a `packages/` directory at script root.
  // A globally installed package has only dist/, templates/, scripts/, etc.
  return existsSync(join(SCRIPT_ROOT, "packages"));
}

// ---------------------------------------------------------------------------
// Template resolution
// ---------------------------------------------------------------------------

function findTemplatesDir() {
  // When running from scripts/ in the repo: templates/ is at root.
  // When running from a globally installed package: scripts/ sits next to
  // templates/ (both are in the package root).
  const candidates = [
    join(SCRIPT_ROOT, "templates"),
    join(__dirname, "..", "templates"),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, ".gru", "config.yaml"))) return c;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Idempotent file seeder
// ---------------------------------------------------------------------------

/**
 * Copy `src` to `dest` only if dest does not already exist.
 * Creates parent directories as needed.
 * Returns true if the file was seeded, false if it already existed.
 */
function seedFile(src, dest) {
  if (existsSync(dest)) return false;
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  return true;
}

/**
 * Recursively seed all files from srcDir into destDir.
 * Only copies files that don't already exist at the destination.
 */
function seedDir(srcDir, destDir) {
  let count = 0;
  const entries = readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);
    if (entry.isDirectory()) {
      count += seedDir(srcPath, destPath);
    } else {
      if (seedFile(srcPath, destPath)) count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// awesome-copilot clone (best-effort, offline-safe)
// ---------------------------------------------------------------------------

function cloneAwesomeCopilot(targetDir) {
  // Skip if already present
  if (existsSync(targetDir)) {
    info("awesome-copilot already present — skipping clone.");
    return;
  }

  // Check git availability — Node resolves git.exe without a shell on all platforms.
  const gitCheck = spawnSync("git", ["--version"], {
    encoding: "utf8",
    timeout: 10_000,
  });
  if (gitCheck.status !== 0) {
    warn(
      "awesome-copilot clone skipped (git not found). " +
      "To install manually: git clone https://github.com/github/awesome-copilot " +
      JSON.stringify(targetDir) +
      "  OR set GRU_AWESOME_COPILOT_PATH env var."
    );
    return;
  }

  info("Cloning awesome-copilot catalog into ~/.gru/awesome-copilot ...");
  mkdirSync(dirname(targetDir), { recursive: true });

  const cloneResult = spawnSync(
    "git",
    ["clone", "--depth", "1", "https://github.com/github/awesome-copilot", targetDir],
    {
      encoding: "utf8",
      timeout: 60_000,   // 60s max — network may be slow
      stdio: "pipe",
    }
  );

  if (cloneResult.status === 0) {
    info("awesome-copilot cloned successfully.");
  } else {
    warn(
      "awesome-copilot clone failed (network unavailable or timeout). " +
      "Run manually later: git clone --depth 1 https://github.com/github/awesome-copilot " +
      JSON.stringify(targetDir) +
      "  OR set GRU_AWESOME_COPILOT_PATH env var."
    );
    // Clean up partial clone directory if it was created
    try {
      if (existsSync(targetDir)) {
        rmSync(targetDir, { recursive: true, force: true });
      }
    } catch {
      // Non-critical cleanup failure — ignore
    }
  }
}

// ---------------------------------------------------------------------------
// Dev context handler
// ---------------------------------------------------------------------------

function runDevContext() {
  info("Dev/monorepo context detected — running cybersec harness check.");
  const cybersecScript = join(SCRIPT_ROOT, "scripts", "setup-cybersec.mjs");

  if (!existsSync(cybersecScript)) {
    warn("setup-cybersec.mjs not found — skipping dev setup check.");
    return;
  }

  const result = spawnSync(
    process.execPath,   // node binary — always available
    [cybersecScript, "--postinstall"],
    {
      cwd: SCRIPT_ROOT,
      stdio: "inherit",
      encoding: "utf8",
      shell: false,
      timeout: 60_000,
    }
  );

  if (result.status !== 0) {
    warn("setup-cybersec.mjs reported issues (non-fatal in postinstall context).");
  }
}

// ---------------------------------------------------------------------------
// Global context handler
// ---------------------------------------------------------------------------

async function runGlobalContext() {
  const homeDir = homedir();
  const gruDir = join(homeDir, ".gru");
  const awesomeCopilotDir = join(gruDir, "awesome-copilot");

  process.stdout.write(GRU_BANNER + "\n");
  info(`Global install context — bootstrapping ~/.gru at: ${gruDir}`);

  // 1. Ensure ~/.gru/ exists
  mkdirSync(gruDir, { recursive: true });
  info("~/.gru/ directory ensured.");

  // 2. Seed default yaml files from templates (no clobber)
  const templatesDir = findTemplatesDir();
  if (!templatesDir) {
    warn(
      "templates/ directory not found — cannot seed default config files. " +
      "Run `gru init` manually after install."
    );
  } else {
    const gruTemplateDir = join(templatesDir, ".gru");
    if (existsSync(gruTemplateDir)) {
      const seeded = seedDir(gruTemplateDir, gruDir);
      if (seeded > 0) {
        info(`Seeded ${seeded} default config file(s) into ~/.gru/.`);
      } else {
        info("~/.gru/ config files already present — no changes.");
      }
    } else {
      warn("templates/.gru/ not found — skipping config seeding.");
    }
  }

  // 3. Clone awesome-copilot (best-effort, never blocking)
  // Env var GRU_SKIP_AWESOME_COPILOT_CLONE=1 skips the clone (useful in tests/CI)
  if (process.env.GRU_SKIP_AWESOME_COPILOT_CLONE === "1") {
    info("awesome-copilot clone skipped (GRU_SKIP_AWESOME_COPILOT_CLONE=1).");
  } else {
    try {
      cloneAwesomeCopilot(awesomeCopilotDir);
    } catch (err) {
      warn(`awesome-copilot clone encountered unexpected error: ${err.message}`);
    }
  }

  info("Global bootstrap complete.");
}

// ---------------------------------------------------------------------------
// Main entry — always exits 0
// ---------------------------------------------------------------------------

async function main() {
  try {
    if (isDevContext()) {
      runDevContext();
    } else {
      await runGlobalContext();
    }
  } catch (err) {
    warn(`Unexpected error during postinstall (non-fatal): ${err.message}`);
    // Do NOT re-throw — postinstall must never break the install
  }

  // Guarantee exit 0 regardless of what happened above
  process.exitCode = 0;
}

main();
