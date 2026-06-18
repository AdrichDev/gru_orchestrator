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
 *       3. Prints an info hint: awesome-copilot is opt-in via `gru init`.
 *          The catalog is NOT cloned here — run `gru init` (or `gru skills sync`)
 *          to download it on demand.
 *
 * Context detection:
 *   A dev/monorepo context is detected by the presence of the `packages/`
 *   directory next to the script (meaning we are running inside the source
 *   checkout, not from an installed package). The env var
 *   GRU_POSTINSTALL_CONTEXT=dev forces the dev path; =global forces the
 *   global path (useful for testing).
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
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
    ____ ____  _   _
   / ___|  _ \\| | | |
  | |  _| |_) | | | |
  | |_| |  _ <| |_| |
   \\____|_| \\_\\_____/   H A R N E S S

  orchestrator · installable globally · gru init → pick your runtime
`;

// ---------------------------------------------------------------------------
// Context detection
// ---------------------------------------------------------------------------

function isDevContext() {
  const envOverride = process.env.GRU_POSTINSTALL_CONTEXT;
  if (envOverride === "dev") return true;
  if (envOverride === "global") return false;

  // SEC-06: robust detection — check whether we are running from inside a
  // node_modules installation path (installed/global context) or from a source
  // checkout (dev context).
  //
  // Strategy (in priority order, first truthy result wins):
  //
  // 1. node_modules path: if __filename contains `node_modules` we are running
  //    as an installed package, NOT a source checkout → global context.
  //
  // 2. package.json "version" sentinel: a published package always has a
  //    package.json; in a source checkout the one next to scripts/ also does,
  //    but the published package will NOT have a `packages/` directory alongside.
  //    We check for `packages/` as a secondary confirmer only.
  //
  // 3. Fallback: presence of `packages/` directory at SCRIPT_ROOT (original
  //    heuristic retained as last resort so dev still gets dev context).
  const normalised = __filename.replace(/\\/g, "/");
  if (normalised.includes("/node_modules/")) {
    // Running from an installed package — global context.
    return false;
  }

  // If there is a `packages/` directory sibling to the script root, we are in
  // a monorepo source checkout — dev context.
  if (existsSync(join(SCRIPT_ROOT, "packages"))) {
    return true;
  }

  // No `packages/` and not in node_modules → assume global install.
  return false;
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

  // 3. awesome-copilot catalog is opt-in — not cloned here.
  info("awesome-copilot catalog is optional — run `gru init` (or `gru skills sync`) to download it.");

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
