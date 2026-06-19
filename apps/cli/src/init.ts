/**
 * gru init — scaffold harness files into a target project.
 *
 * Install-scope behaviour:
 *   PROJECT  → .gru/ + harness files live in <cwd>/
 *   GLOBAL   → .gru/ lives in ~/.gru/; no cwd/.gru/ is created
 *
 * Runtime selection:
 *   The user picks one or more runtimes via --runtime flag or an interactive
 *   multi-select menu. Only the selected runtime files are scaffolded.
 *   Shared files (config, contracts, .mcp.json) are always written.
 *
 * Runtimes:
 *   claude      → .claude/CLAUDE.md + .claude/agents/cybersec/* + .claude/skills/*
 *   codex       → .codex/AGENTS.md (+ root AGENTS.md) + .codex/agents/cybersec/* + .codex/skills/*
 *   gemini      → .gemini/GEMINI.md + .gemini/agents/cybersec/* + .gemini/skills/*
 *   opencode    → .config/opencode/AGENTS.md + opencode.json
 *   cursor      → .cursor/rules/gru.mdc + AGENTS.md
 *   antigravity → AGENTS.md at root (same as codex/cursor, deduped)
 *
 * Template resolution:
 *   Templates ship as flat files under templates/ in the published package.
 *   At runtime the directory is resolved relative to __dirname so it works
 *   both in the CJS bundle (dist/cli.cjs → dist/../templates) and in the
 *   monorepo dev environment (apps/cli/src/init.ts → ../../../templates).
 *
 * Idempotency:
 *   Existing files are skipped unless --force is passed.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { stdin as input, stdout as output } from "node:process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InstallScope = "project" | "global";

export type RuntimeId =
  | "claude"
  | "codex"
  | "gemini"
  | "opencode"
  | "cursor"
  | "antigravity";

export const ALL_RUNTIMES: readonly RuntimeId[] = [
  "claude",
  "codex",
  "gemini",
  "opencode",
  "cursor",
  "antigravity",
];

export interface InitOptions {
  /** "project" | "global" — skip prompt when provided */
  scope?: InstallScope;
  /** Overwrite existing files */
  force?: boolean;
  /** Override cwd (used by tests) */
  cwd?: string;
  /** Override home dir (used by tests) */
  home?: string;
  /**
   * Runtimes to scaffold. If not provided and non-interactive, defaults to
   * ["claude"]. If not provided and interactive, show multi-select menu.
   */
  runtimes?: RuntimeId[];
  /**
   * Download the awesome-copilot skills catalog (~100MB) into ~/.gru/awesome-copilot.
   * true  → clone without prompting (--awesome-copilot / --skills flag).
   * false → skip without prompting (non-interactive default).
   * undefined → ask interactively when TTY is available (default: No).
   */
  awesomeCopilot?: boolean;
  /**
   * Injectable git runner for testing — replaces the real spawnSync git call.
   * Receives (args: string[], targetDir: string) and returns { status: number }.
   */
  _gitRunner?: (args: string[], targetDir: string) => { status: number };
}

export interface FileResult {
  dest: string;
  status: "created" | "skipped" | "overwritten";
}

export interface InitResult {
  scope: InstallScope;
  runtimes: RuntimeId[];
  files: FileResult[];
  /** Status of the awesome-copilot catalog download step. */
  awesomeCopilotStatus: "downloaded" | "already-present" | "skipped" | "failed";
}

// ---------------------------------------------------------------------------
// Template directory resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the templates/ directory.
 *
 * Production (CJS bundle at dist/cli.cjs):
 *   __dirname = <pkg>/dist  →  templates = <pkg>/templates
 *
 * Dev (ts-node / tsx running apps/cli/src/init.ts):
 *   __dirname = <repo>/apps/cli/src  →  templates = <repo>/templates
 *
 * The function walks up until it finds a directory named "templates" that
 * contains ".gru/config.yaml" as a sanity-check sentinel.
 */
export function resolveTemplatesDir(): string {
  // Candidate 1: same directory as the current file (covers CJS bundle case
  // where tsup puts everything in dist/ and templates/ is a sibling of dist/).
  const candidates = [
    path.resolve(__dirname, "..", "templates"), // dist/../templates  (npm install)
    path.resolve(__dirname, "..", "..", "..", "templates"), // apps/cli/src/../../../templates  (monorepo dev)
    path.resolve(__dirname, "templates"), // fallback: alongside the file
  ];

  for (const candidate of candidates) {
    if (
      fs.existsSync(path.join(candidate, ".gru", "config.yaml"))
    ) {
      return candidate;
    }
  }

  throw new Error(
    `Cannot locate templates/ directory. Searched:\n${candidates.join("\n")}\n` +
    "Ensure the templates/ directory is published alongside dist/cli.cjs."
  );
}

// ---------------------------------------------------------------------------
// Scope selection
// ---------------------------------------------------------------------------

/**
 * Detect scope from CLI flags or, when running interactively, prompt the user.
 */
export async function resolveScope(
  options: Pick<InitOptions, "scope" | "cwd">
): Promise<InstallScope> {
  const { scope, cwd = process.cwd() } = options;

  // If explicit flag provided, use it.
  if (scope) return scope;

  // If .gru/ already exists in cwd, infer PROJECT (no re-prompt).
  if (fs.existsSync(path.join(cwd, ".gru"))) {
    return "project";
  }

  // Non-interactive: default to project.
  if (!process.stdin.isTTY) {
    return "project";
  }

  // Interactive: prompt.
  const rl = readline.createInterface({ input, output });
  try {
    console.log("\nInstall scope:");
    console.log("  [1] PROJECT — config + harness files in <cwd>/.gru/ and <cwd>/");
    console.log("  [2] GLOBAL  — config in ~/.gru/; no <cwd>/.gru/ created");
    const answer = await rl.question("\nChoose [1/2] (default: 1): ");
    const trimmed = answer.trim();
    if (trimmed === "2" || trimmed.toLowerCase() === "global") {
      return "global";
    }
    return "project";
  } finally {
    rl.close();
  }
}

// ---------------------------------------------------------------------------
// Runtime selection
// ---------------------------------------------------------------------------

/**
 * Validate a runtime string against the known list.
 */
export function isValidRuntime(value: string): value is RuntimeId {
  return (ALL_RUNTIMES as readonly string[]).includes(value);
}

/**
 * Resolve runtimes from CLI flags or, when running interactively, prompt
 * the user with a multi-select menu (gentleman-cli style).
 *
 * - If runtimes are explicitly provided, use them.
 * - If non-interactive (no TTY), default to ["claude"].
 * - If interactive, show numbered menu; user picks one or more (or "all").
 */
export async function resolveRuntimes(
  options: Pick<InitOptions, "runtimes">
): Promise<RuntimeId[]> {
  const { runtimes } = options;

  // Explicit runtimes provided (from --runtime flag).
  if (runtimes && runtimes.length > 0) return runtimes;

  // Non-interactive default.
  if (!process.stdin.isTTY) {
    return ["claude"];
  }

  // Interactive multi-select menu.
  const rl = readline.createInterface({ input, output });
  try {
    console.log("\nTarget runtimes (multi-select, comma-separated):");
    const runtimeList: RuntimeId[] = [...ALL_RUNTIMES];
    runtimeList.forEach((rt, i) => {
      const descriptions: Record<RuntimeId, string> = {
        claude:      "Claude Code (.claude/CLAUDE.md + agents + skills)",
        codex:       "OpenAI Codex (.codex/AGENTS.md + root AGENTS.md)",
        gemini:      "Gemini CLI (.gemini/GEMINI.md)",
        opencode:    "OpenCode (.config/opencode/AGENTS.md + opencode.json)",
        cursor:      "Cursor (.cursor/rules/gru.mdc + AGENTS.md)",
        antigravity: "Antigravity (root AGENTS.md)",
      };
      console.log(`  [${i + 1}] ${rt.padEnd(12)} — ${descriptions[rt]}`);
    });
    console.log("  [a] all runtimes");

    const answer = await rl.question(
      "\nChoose runtimes [1-6, comma-separated, or 'all'] (default: 1): "
    );
    const trimmed = answer.trim().toLowerCase();

    if (!trimmed || trimmed === "1") return ["claude"];
    if (trimmed === "a" || trimmed === "all") return [...ALL_RUNTIMES];

    const parts = trimmed.split(",").map((s) => s.trim());
    const selected: RuntimeId[] = [];
    for (const part of parts) {
      const idx = parseInt(part, 10);
      if (!isNaN(idx) && idx >= 1 && idx <= runtimeList.length) {
        selected.push(runtimeList[idx - 1]);
      } else if (isValidRuntime(part)) {
        selected.push(part as RuntimeId);
      }
    }
    return selected.length > 0 ? selected : ["claude"];
  } finally {
    rl.close();
  }
}

// ---------------------------------------------------------------------------
// File manifest
// ---------------------------------------------------------------------------

interface TemplateEntry {
  /** Path relative to templates/ */
  src: string;
  /**
   * Destination resolver.
   * For PROJECT: relative to cwd.
   * For GLOBAL: relative to cwd, EXCEPT .gru/* which goes to ~/.gru/*.
   */
  destRelative: string;
  /** Only written for PROJECT scope (not GLOBAL) */
  projectOnly?: boolean;
  /**
   * Runtime this entry belongs to. "shared" means always written regardless
   * of runtime selection.
   */
  runtime?: RuntimeId | "shared";
}

const TEMPLATE_ENTRIES: TemplateEntry[] = [
  // ── Shared (always written) ────────────────────────────────────────────
  { src: ".gru/config.yaml",            destRelative: ".gru/config.yaml",            runtime: "shared" },
  { src: ".gru/providers.yaml",         destRelative: ".gru/providers.yaml",         runtime: "shared" },
  { src: ".gru/skills.yaml",            destRelative: ".gru/skills.yaml",            runtime: "shared" },
  { src: "minion-contract.md",          destRelative: "minion-contract.md",          runtime: "shared", projectOnly: true },
  { src: "cybersec-minion-contract.md", destRelative: "cybersec-minion-contract.md", runtime: "shared", projectOnly: true },
  { src: ".mcp.json",                   destRelative: ".mcp.json",                   runtime: "shared", projectOnly: true },

  // ── Claude ────────────────────────────────────────────────────────────
  { src: "CLAUDE.md",              destRelative: "CLAUDE.md",              runtime: "claude", projectOnly: true },
  { src: ".claude/CLAUDE.md",      destRelative: ".claude/CLAUDE.md",      runtime: "claude", projectOnly: true },

  // Cybersec agent files (Claude runtime)
  { src: ".claude/agents/cybersec/blueteam-coordinator.agent.md",   destRelative: ".claude/agents/cybersec/blueteam-coordinator.agent.md",   runtime: "claude", projectOnly: true },
  { src: ".claude/agents/cybersec/blueteam-detect.agent.md",        destRelative: ".claude/agents/cybersec/blueteam-detect.agent.md",        runtime: "claude", projectOnly: true },
  { src: ".claude/agents/cybersec/blueteam-hardening.agent.md",     destRelative: ".claude/agents/cybersec/blueteam-hardening.agent.md",     runtime: "claude", projectOnly: true },
  { src: ".claude/agents/cybersec/blueteam-incident.agent.md",      destRelative: ".claude/agents/cybersec/blueteam-incident.agent.md",      runtime: "claude", projectOnly: true },
  { src: ".claude/agents/cybersec/purpleteam-coordinator.agent.md", destRelative: ".claude/agents/cybersec/purpleteam-coordinator.agent.md", runtime: "claude", projectOnly: true },
  { src: ".claude/agents/cybersec/redteam-coordinator.agent.md",    destRelative: ".claude/agents/cybersec/redteam-coordinator.agent.md",    runtime: "claude", projectOnly: true },
  { src: ".claude/agents/cybersec/redteam-exploit.agent.md",        destRelative: ".claude/agents/cybersec/redteam-exploit.agent.md",        runtime: "claude", projectOnly: true },
  { src: ".claude/agents/cybersec/redteam-recon.agent.md",          destRelative: ".claude/agents/cybersec/redteam-recon.agent.md",          runtime: "claude", projectOnly: true },

  // Cybersec skills (all 5 bundles — Claude runtime)
  { src: ".claude/skills/cybersec-audit/SKILL.md",   destRelative: ".claude/skills/cybersec-audit/SKILL.md",   runtime: "claude", projectOnly: true },
  { src: ".claude/skills/redteam-attack/SKILL.md",   destRelative: ".claude/skills/redteam-attack/SKILL.md",   runtime: "claude", projectOnly: true },
  { src: ".claude/skills/blueteam-defense/SKILL.md", destRelative: ".claude/skills/blueteam-defense/SKILL.md", runtime: "claude", projectOnly: true },
  { src: ".claude/skills/threat-modeling/SKILL.md",  destRelative: ".claude/skills/threat-modeling/SKILL.md",  runtime: "claude", projectOnly: true },
  { src: ".claude/skills/purple-loop/SKILL.md",      destRelative: ".claude/skills/purple-loop/SKILL.md",      runtime: "claude", projectOnly: true },
  { src: ".claude/skills/purple-loop/_pl/SKILL.md",  destRelative: ".claude/skills/purple-loop/_pl/SKILL.md",  runtime: "claude", projectOnly: true },

  // Skill registry (Claude)
  { src: ".atl/skill-registry.md", destRelative: ".atl/skill-registry.md", runtime: "claude", projectOnly: true },

  // ── Codex ─────────────────────────────────────────────────────────────
  { src: ".codex/AGENTS.md",  destRelative: ".codex/AGENTS.md",  runtime: "codex", projectOnly: true },
  // AGENTS.md at root — shared by codex/cursor/antigravity; deduped via dest
  { src: "AGENTS.md",         destRelative: "AGENTS.md",         runtime: "codex", projectOnly: true },

  // Codex cybersec agents (.toml format)
  { src: ".codex/agents/cybersec/blueteam-coordinator.toml",   destRelative: ".codex/agents/cybersec/blueteam-coordinator.toml",   runtime: "codex", projectOnly: true },
  { src: ".codex/agents/cybersec/blueteam-detect.toml",        destRelative: ".codex/agents/cybersec/blueteam-detect.toml",        runtime: "codex", projectOnly: true },
  { src: ".codex/agents/cybersec/blueteam-hardening.toml",     destRelative: ".codex/agents/cybersec/blueteam-hardening.toml",     runtime: "codex", projectOnly: true },
  { src: ".codex/agents/cybersec/blueteam-incident.toml",      destRelative: ".codex/agents/cybersec/blueteam-incident.toml",      runtime: "codex", projectOnly: true },
  { src: ".codex/agents/cybersec/purpleteam-coordinator.toml", destRelative: ".codex/agents/cybersec/purpleteam-coordinator.toml", runtime: "codex", projectOnly: true },
  { src: ".codex/agents/cybersec/redteam-coordinator.toml",    destRelative: ".codex/agents/cybersec/redteam-coordinator.toml",    runtime: "codex", projectOnly: true },
  { src: ".codex/agents/cybersec/redteam-exploit.toml",        destRelative: ".codex/agents/cybersec/redteam-exploit.toml",        runtime: "codex", projectOnly: true },
  { src: ".codex/agents/cybersec/redteam-recon.toml",          destRelative: ".codex/agents/cybersec/redteam-recon.toml",          runtime: "codex", projectOnly: true },

  // Codex cybersec skills (same 5 bundles as Claude — runtime-agnostic markdown)
  { src: ".codex/skills/cybersec-audit/SKILL.md",   destRelative: ".codex/skills/cybersec-audit/SKILL.md",   runtime: "codex", projectOnly: true },
  { src: ".codex/skills/redteam-attack/SKILL.md",   destRelative: ".codex/skills/redteam-attack/SKILL.md",   runtime: "codex", projectOnly: true },
  { src: ".codex/skills/blueteam-defense/SKILL.md", destRelative: ".codex/skills/blueteam-defense/SKILL.md", runtime: "codex", projectOnly: true },
  { src: ".codex/skills/threat-modeling/SKILL.md",  destRelative: ".codex/skills/threat-modeling/SKILL.md",  runtime: "codex", projectOnly: true },
  { src: ".codex/skills/purple-loop/SKILL.md",      destRelative: ".codex/skills/purple-loop/SKILL.md",      runtime: "codex", projectOnly: true },
  { src: ".codex/skills/purple-loop/_pl/SKILL.md",  destRelative: ".codex/skills/purple-loop/_pl/SKILL.md",  runtime: "codex", projectOnly: true },

  // ── Gemini ────────────────────────────────────────────────────────────
  { src: ".gemini/GEMINI.md",  destRelative: ".gemini/GEMINI.md",  runtime: "gemini", projectOnly: true },

  // Gemini cybersec agents (.md format)
  { src: ".gemini/agents/cybersec/blueteam-coordinator.md",   destRelative: ".gemini/agents/cybersec/blueteam-coordinator.md",   runtime: "gemini", projectOnly: true },
  { src: ".gemini/agents/cybersec/blueteam-detect.md",        destRelative: ".gemini/agents/cybersec/blueteam-detect.md",        runtime: "gemini", projectOnly: true },
  { src: ".gemini/agents/cybersec/blueteam-hardening.md",     destRelative: ".gemini/agents/cybersec/blueteam-hardening.md",     runtime: "gemini", projectOnly: true },
  { src: ".gemini/agents/cybersec/blueteam-incident.md",      destRelative: ".gemini/agents/cybersec/blueteam-incident.md",      runtime: "gemini", projectOnly: true },
  { src: ".gemini/agents/cybersec/purpleteam-coordinator.md", destRelative: ".gemini/agents/cybersec/purpleteam-coordinator.md", runtime: "gemini", projectOnly: true },
  { src: ".gemini/agents/cybersec/redteam-coordinator.md",    destRelative: ".gemini/agents/cybersec/redteam-coordinator.md",    runtime: "gemini", projectOnly: true },
  { src: ".gemini/agents/cybersec/redteam-exploit.md",        destRelative: ".gemini/agents/cybersec/redteam-exploit.md",        runtime: "gemini", projectOnly: true },
  { src: ".gemini/agents/cybersec/redteam-recon.md",          destRelative: ".gemini/agents/cybersec/redteam-recon.md",          runtime: "gemini", projectOnly: true },

  // Gemini cybersec skills (same 5 bundles as Claude — runtime-agnostic markdown)
  { src: ".gemini/skills/cybersec-audit/SKILL.md",   destRelative: ".gemini/skills/cybersec-audit/SKILL.md",   runtime: "gemini", projectOnly: true },
  { src: ".gemini/skills/redteam-attack/SKILL.md",   destRelative: ".gemini/skills/redteam-attack/SKILL.md",   runtime: "gemini", projectOnly: true },
  { src: ".gemini/skills/blueteam-defense/SKILL.md", destRelative: ".gemini/skills/blueteam-defense/SKILL.md", runtime: "gemini", projectOnly: true },
  { src: ".gemini/skills/threat-modeling/SKILL.md",  destRelative: ".gemini/skills/threat-modeling/SKILL.md",  runtime: "gemini", projectOnly: true },
  { src: ".gemini/skills/purple-loop/SKILL.md",      destRelative: ".gemini/skills/purple-loop/SKILL.md",      runtime: "gemini", projectOnly: true },
  { src: ".gemini/skills/purple-loop/_pl/SKILL.md",  destRelative: ".gemini/skills/purple-loop/_pl/SKILL.md",  runtime: "gemini", projectOnly: true },

  // ── OpenCode ──────────────────────────────────────────────────────────
  { src: ".config/opencode/AGENTS.md",    destRelative: ".config/opencode/AGENTS.md",    runtime: "opencode", projectOnly: true },
  { src: ".config/opencode/opencode.json", destRelative: ".config/opencode/opencode.json", runtime: "opencode", projectOnly: true },

  // ── Cursor ────────────────────────────────────────────────────────────
  { src: ".cursor/rules/gru.mdc", destRelative: ".cursor/rules/gru.mdc", runtime: "cursor", projectOnly: true },
  // Cursor also reads AGENTS.md — written here, deduped if codex/antigravity already wrote it
  { src: "AGENTS.md",             destRelative: "AGENTS.md",             runtime: "cursor", projectOnly: true },

  // ── Antigravity ───────────────────────────────────────────────────────
  // Antigravity follows the AGENTS.md convention (root only)
  { src: "AGENTS.md", destRelative: "AGENTS.md", runtime: "antigravity", projectOnly: true },
];

/**
 * Build the ordered list of files to scaffold based on the chosen scope and
 * selected runtimes. Deduplicates by destination path so runtimes that share
 * files (e.g. codex + cursor both want AGENTS.md) only write once.
 */
export function buildManifest(
  scope: InstallScope,
  cwd: string,
  home: string,
  runtimes: readonly RuntimeId[] = ["claude"]
): Array<{ src: string; dest: string }> {
  const runtimeSet = new Set<RuntimeId | "shared">(runtimes);
  runtimeSet.add("shared");

  const gruBase = scope === "global" ? path.join(home, ".gru") : path.join(cwd, ".gru");

  const seen = new Set<string>();
  const result: Array<{ src: string; dest: string }> = [];

  for (const entry of TEMPLATE_ENTRIES) {
    // Filter by runtime
    const entryRuntime = entry.runtime ?? "shared";
    if (!runtimeSet.has(entryRuntime)) continue;

    // Filter by scope
    if (scope === "global" && entry.projectOnly) continue;

    // Compute destination
    let dest: string;
    if (entry.destRelative.startsWith(".gru/")) {
      dest = path.join(gruBase, entry.destRelative.slice(".gru/".length));
    } else {
      dest = path.join(cwd, entry.destRelative);
    }

    // Deduplicate by dest — first entry wins (earlier runtimes in list win)
    if (seen.has(dest)) continue;
    seen.add(dest);

    result.push({ src: entry.src, dest });
  }

  return result;
}

// ---------------------------------------------------------------------------
// awesome-copilot opt-in resolver
// ---------------------------------------------------------------------------

/**
 * Ask the user whether to download the awesome-copilot catalog.
 * Only called when running interactively and awesomeCopilot is not explicitly set.
 * Default answer is No (empty input → skip).
 */
export async function resolveAwesomeCopilotOptIn(
  options: Pick<InitOptions, "awesomeCopilot">
): Promise<boolean> {
  // Explicit flag takes priority.
  if (options.awesomeCopilot === true) return true;
  if (options.awesomeCopilot === false) return false;

  // Non-interactive: default skip.
  if (!process.stdin.isTTY) return false;

  // Interactive: prompt with default No.
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(
      "\nDownload the awesome-copilot skills catalog (~100MB)? (y/N): "
    );
    return answer.trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}

// ---------------------------------------------------------------------------
// awesome-copilot clone helper
// ---------------------------------------------------------------------------

const AWESOME_COPILOT_REPO = "https://github.com/github/awesome-copilot";

/**
 * Clone the awesome-copilot catalog into targetDir using `git clone --depth 1`.
 *
 * - Always targets ~/.gru/awesome-copilot regardless of init scope (shared catalog).
 * - Offline-safe: git missing or clone failure → warn + hint, never throws.
 * - Injectable _gitRunner for tests (avoids real network calls).
 *
 * Returns a status string describing the outcome.
 */
export function cloneAwesomeCopilotCatalog(
  targetDir: string,
  _gitRunner?: (args: string[], targetDir: string) => { status: number }
): "downloaded" | "already-present" | "failed" {
  // Skip if already present.
  if (fs.existsSync(targetDir)) {
    console.log(`  awesome-copilot: already present at ${targetDir} — skipping clone.`);
    return "already-present";
  }

  // Default runner: real spawnSync git call (no shell:true, static args).
  const runner =
    _gitRunner ??
    ((args: string[], dir: string): { status: number } => {
      // Check git availability first.
      const gitCheck = spawnSync("git", ["--version"], {
        encoding: "utf8",
        timeout: 10_000,
        shell: false,
      });
      if (gitCheck.status !== 0) {
        return { status: -1 };
      }
      const result = spawnSync("git", args, {
        encoding: "utf8",
        timeout: 120_000,
        stdio: "pipe",
        shell: false,
      });
      return { status: result.status ?? -1 };
    });

  console.log(`  Cloning awesome-copilot catalog into ${targetDir} ...`);
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });

  const result = runner(
    ["clone", "--depth", "1", AWESOME_COPILOT_REPO, targetDir],
    targetDir
  );

  if (result.status === 0) {
    console.log("  awesome-copilot: downloaded successfully.");
    return "downloaded";
  }

  console.warn(
    `  WARNING: awesome-copilot clone failed (git not found, network unavailable, or timeout).\n` +
    `  To install manually later:\n` +
    `    git clone --depth 1 ${AWESOME_COPILOT_REPO} ${JSON.stringify(targetDir)}\n` +
    `  OR set the GRU_AWESOME_COPILOT_PATH env var to an existing local copy.`
  );
  return "failed";
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run `gru init` — scaffold harness files into target project.
 */
export async function runInit(options: InitOptions = {}): Promise<InitResult> {
  const cwd = options.cwd ?? process.cwd();
  const home = options.home ?? os.homedir();
  const force = options.force ?? false;

  // 1. Resolve scope
  const scope = await resolveScope({ scope: options.scope, cwd });

  // 2. Resolve runtimes
  const runtimes = await resolveRuntimes({ runtimes: options.runtimes });

  // 3. Resolve awesome-copilot opt-in (ask interactively if TTY and not set)
  const downloadAwesomeCopilot = await resolveAwesomeCopilotOptIn({
    awesomeCopilot: options.awesomeCopilot,
  });

  // 4. Locate templates
  const templatesDir = resolveTemplatesDir();

  // 5. Build file manifest
  const manifest = buildManifest(scope, cwd, home, runtimes);

  // 6. Scaffold each file
  //
  // SEC-07: when --force is active AND stdout is a TTY, list the files that
  // would be overwritten and require explicit confirmation before clobbering.
  // Non-interactive (no TTY) keeps the existing .bak side-write behaviour.
  const wouldOverwrite = manifest.filter(({ dest }) => {
    const srcPath = path.join(templatesDir, manifest.find((m) => m.dest === dest)?.src ?? "");
    return fs.existsSync(dest);
  });

  if (force && process.stdout.isTTY && wouldOverwrite.length > 0) {
    console.log("\n--force: the following existing files will be overwritten (a .bak backup is created first):");
    for (const { dest } of wouldOverwrite) {
      console.log(`  ~ ${dest}`);
    }
    const rl = readline.createInterface({ input, output });
    let confirmed = false;
    try {
      const answer = await rl.question(`\nOverwrite ${wouldOverwrite.length} file(s)? Type "yes" to confirm: `);
      confirmed = answer.trim().toLowerCase() === "yes";
    } finally {
      rl.close();
    }
    if (!confirmed) {
      console.log("Aborted by user — no files were overwritten.");
      return { scope, runtimes, files: [], awesomeCopilotStatus: "skipped" };
    }
  }

  const files: FileResult[] = [];
  for (const { src, dest } of manifest) {
    const existed = fs.existsSync(dest);
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    const srcPath = path.join(templatesDir, src);
    if (!fs.existsSync(srcPath)) {
      files.push({ dest, status: "skipped" });
      continue;
    }

    if (existed && !force) {
      files.push({ dest, status: "skipped" });
      continue;
    }

    // When overwriting under --force, write a .bak backup first.
    if (existed && force) {
      fs.copyFileSync(dest, `${dest}.bak`);
    }

    fs.copyFileSync(srcPath, dest);
    files.push({ dest, status: existed && force ? "overwritten" : "created" });
  }

  // 7. awesome-copilot catalog — always into ~/.gru/awesome-copilot (shared, machine-wide).
  //    Scope (project vs global) does not affect the target: it is always home-based.
  let awesomeCopilotStatus: InitResult["awesomeCopilotStatus"] = "skipped";
  if (downloadAwesomeCopilot) {
    const acTargetDir = path.join(home, ".gru", "awesome-copilot");
    awesomeCopilotStatus = cloneAwesomeCopilotCatalog(acTargetDir, options._gitRunner);
  }

  return { scope, runtimes, files, awesomeCopilotStatus };
}

// ---------------------------------------------------------------------------
// CLI output formatter
// ---------------------------------------------------------------------------

export function printInitSummary(result: InitResult): void {
  const { scope, runtimes, files, awesomeCopilotStatus } = result;

  const created     = files.filter((f) => f.status === "created");
  const skipped     = files.filter((f) => f.status === "skipped");
  const overwritten = files.filter((f) => f.status === "overwritten");

  console.log(`\ngru init — scope: ${scope.toUpperCase()} | runtimes: ${runtimes.join(", ")}\n`);

  if (created.length > 0) {
    console.log("Created:");
    for (const f of created) console.log(`  + ${f.dest}`);
  }

  if (overwritten.length > 0) {
    console.log("Overwritten (--force):");
    for (const f of overwritten) console.log(`  ~ ${f.dest}`);
  }

  if (skipped.length > 0) {
    console.log("Skipped (already exists):");
    for (const f of skipped) console.log(`  = ${f.dest}`);
  }

  console.log(`\nSummary: ${created.length} created, ${overwritten.length} overwritten, ${skipped.length} skipped.`);

  const acLabel: Record<InitResult["awesomeCopilotStatus"], string> = {
    downloaded:      "downloaded",
    "already-present": "already present (skipped re-clone)",
    skipped:         "skipped (pass --awesome-copilot to download)",
    failed:          "download failed — see warning above",
  };
  console.log(`awesome-copilot: ${acLabel[awesomeCopilotStatus]}`);

  console.log("\nNext steps:");
  if (scope === "project") {
    console.log("  1. Review .gru/config.yaml and set your project name.");
    console.log("  2. Review .gru/providers.yaml and enable/disable providers.");
    console.log("  3. Run: gru status  — verify provider availability.");
    console.log("  4. Commit .gru/ and harness files to your repo.");
  } else {
    console.log("  1. Review ~/.gru/config.yaml and set defaults.");
    console.log("  2. Run: gru status  — verify provider availability.");
    console.log("  3. Use: gru init --scope project  inside each project for per-project config.");
  }
}
