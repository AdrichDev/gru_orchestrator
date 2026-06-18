import fs from "fs";
import os from "os";
import path from "path";

/**
 * Resolves the gru root directory using strict priority order:
 *
 * 1. GRU_CONFIG_DIR env var — if set and the directory exists, use it.
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
  if (envDir && fs.existsSync(envDir)) {
    return envDir;
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
 * GRU_RUNS_DIR env var wins if set.
 */
export function resolveRunsDir(): string {
  const envRunsDir = process.env.GRU_RUNS_DIR;
  if (envRunsDir) {
    return envRunsDir;
  }
  return path.join(resolveGruRoot(), "runs");
}

/**
 * Resolves the awesome-copilot catalog directory.
 * Priority:
 *   1. GRU_AWESOME_COPILOT_PATH env var (preserves existing override behavior).
 *   2. <gru-root>/awesome-copilot
 * Note: does NOT fall back to vendor/awesome-copilot — that was a monorepo-only path.
 */
export function resolveAwesomeCopilotPath(): string {
  const envPath = process.env.GRU_AWESOME_COPILOT_PATH;
  if (envPath) {
    return envPath;
  }
  return path.join(resolveGruRoot(), "awesome-copilot");
}
