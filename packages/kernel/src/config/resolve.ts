import fs from "fs";
import os from "os";
import path from "path";

// ── SEC-03: path traversal guard ─────────────────────────────────────────────

/**
 * Returns true when `value` is a safe directory override for GRU_CONFIG_DIR or
 * GRU_RUNS_DIR:
 *   - No `..` segments (traversal).
 *   - Resolved path must be under the user home directory OR under process.cwd()
 *     (the project root).
 *
 * If invalid, the caller MUST fall back to the safe default and warn.
 */
function isAllowedOverridePath(value: string): boolean {
  // Reject any path component that is exactly ".."
  if (value.split(/[\\/]/).some((seg) => seg === "..")) return false;

  const resolved = path.resolve(value);
  const home = os.homedir();
  const cwd = process.cwd();

  // Must be under home OR under cwd
  return resolved.startsWith(home + path.sep) ||
         resolved === home ||
         resolved.startsWith(cwd + path.sep) ||
         resolved === cwd;
}

// ── End SEC-03 ────────────────────────────────────────────────────────────────

/**
 * Resolves the gru root directory using strict priority order:
 *
 * 1. GRU_CONFIG_DIR env var — if set, validated, and the directory exists, use it.
 * 2. Nearest project .gru/ — walk up from process.cwd() looking for a .gru/ dir.
 * 3. ~/.gru/ fallback — os.homedir()/.gru.
 *
 * The returned path is the gru root directory itself (e.g. /project/.gru or ~/.gru).
 * It is NOT guaranteed to exist when using the home fallback — callers must create
 * it if needed.
 *
 * Dependency-free: uses only node built-ins (fs, os, path).
 */
export function resolveGruRoot(): string {
  // Priority 1: explicit env override
  const envDir = process.env.GRU_CONFIG_DIR;
  if (envDir) {
    // SEC-03: reject traversal or out-of-bounds paths
    if (!isAllowedOverridePath(envDir)) {
      process.stderr.write(
        `[gru] WARN: GRU_CONFIG_DIR rejected (traversal or out-of-bounds path: "${envDir}"). Falling back to project/home .gru/.\n`
      );
    } else if (fs.existsSync(envDir)) {
      return envDir;
    }
  }

  // Priority 2: nearest project .gru/ walking up from cwd
  const projectGru = findProjectGru(process.cwd());
  if (projectGru) {
    return projectGru;
  }

  // Priority 3: home fallback
  return path.join(os.homedir(), ".gru");
}

/**
 * Walk up from startDir looking for a .gru/ directory.
 * Returns the full path to .gru/ if found, otherwise null.
 */
function findProjectGru(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, ".gru");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      // Reached filesystem root — not found
      return null;
    }
    dir = parent;
  }
}

// ── Resolved path helpers ──────────────────────────────────────────────────────

/**
 * Resolves the path to config.yaml inside the gru root.
 * Calls resolveGruRoot() on every call — no caching, so env changes in tests work.
 */
export function resolveConfigPath(): string {
  return path.join(resolveGruRoot(), "config.yaml");
}

/**
 * Resolves the path to providers.yaml inside the gru root.
 */
export function resolveProvidersPath(): string {
  return path.join(resolveGruRoot(), "providers.yaml");
}

/**
 * Resolves the runs/ log directory.
 * Rule: runs/ always lives inside the resolved gru root.
 * - Project .gru/ present → <project>/.gru/runs/
 * - Home fallback → ~/.gru/runs/
 * GRU_RUNS_DIR env var wins if set AND passes the SEC-03 path guard.
 */
export function resolveRunsDir(): string {
  const envRunsDir = process.env.GRU_RUNS_DIR;
  if (envRunsDir) {
    // SEC-03: reject traversal or out-of-bounds paths
    if (!isAllowedOverridePath(envRunsDir)) {
      process.stderr.write(
        `[gru] WARN: GRU_RUNS_DIR rejected (traversal or out-of-bounds path: "${envRunsDir}"). Falling back to <gru-root>/runs.\n`
      );
    } else {
      return envRunsDir;
    }
  }
  return path.join(resolveGruRoot(), "runs");
}

/**
 * Resolves the awesome-copilot catalog directory.
 * Priority order (first path that exists wins):
 *   1. GRU_AWESOME_COPILOT_PATH env var — explicit override.
 *   2. <project-root>/.gru/awesome-copilot — project-scoped install.
 *   3. <project-root>/vendor/awesome-copilot — in-repo vendored copy (walked up from cwd).
 *   4. ~/.gru/awesome-copilot — global home fallback.
 *
 * If none of the candidate paths exist, returns the .gru path (priority 2) so
 * that any install hint displayed to the user still makes sense.
 */
export function resolveAwesomeCopilotPath(): string {
  // Priority 1: explicit env override (no existence check — caller sets it deliberately).
  const envPath = process.env.GRU_AWESOME_COPILOT_PATH;
  if (envPath) {
    return envPath;
  }

  // Priority 2: project .gru/awesome-copilot
  const gruRoot = resolveGruRoot();
  const gruAcPath = path.join(gruRoot, "awesome-copilot");
  if (fs.existsSync(gruAcPath)) {
    return gruAcPath;
  }

  // Priority 3: vendor/awesome-copilot — walk up from cwd to project root.
  const vendorAcPath = findVendorAwesomeCopilot(process.cwd());
  if (vendorAcPath) {
    return vendorAcPath;
  }

  // Priority 4: ~/.gru/awesome-copilot
  const homeAcPath = path.join(os.homedir(), ".gru", "awesome-copilot");
  if (fs.existsSync(homeAcPath)) {
    return homeAcPath;
  }

  // None found — return .gru path so install hint still makes sense.
  return gruAcPath;
}

/**
 * Walk up from startDir looking for a vendor/awesome-copilot directory.
 * Returns the full path if found, otherwise null.
 */
function findVendorAwesomeCopilot(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, "vendor", "awesome-copilot");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}
