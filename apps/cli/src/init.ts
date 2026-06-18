/**
 * gru init — scaffold harness files into a target project.
 *
 * Install-scope behaviour:
 *   PROJECT  → .gru/ + harness files live in <cwd>/
 *   GLOBAL   → .gru/ lives in ~/.gru/; no cwd/.gru/ is created
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
import { stdin as input, stdout as output } from "node:process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InstallScope = "project" | "global";

export interface InitOptions {
  /** "project" | "global" — skip prompt when provided */
  scope?: InstallScope;
  /** Overwrite existing files */
  force?: boolean;
  /** Override cwd (used by tests) */
  cwd?: string;
  /** Override home dir (used by tests) */
  home?: string;
}

export interface FileResult {
  dest: string;
  status: "created" | "skipped" | "overwritten";
}

export interface InitResult {
  scope: InstallScope;
  files: FileResult[];
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
}

/**
 * Build the ordered list of files to scaffold based on the chosen scope.
 */
export function buildManifest(
  scope: InstallScope,
  cwd: string,
  home: string
): Array<{ src: string; dest: string }> {
  const entries: TemplateEntry[] = [
    // .gru/ config files
    { src: ".gru/config.yaml",    destRelative: ".gru/config.yaml" },
    { src: ".gru/providers.yaml", destRelative: ".gru/providers.yaml" },
    { src: ".gru/skills.yaml",    destRelative: ".gru/skills.yaml" },

    // Root harness instruction files (project scope only for cwd placement)
    { src: "CLAUDE.md",                      destRelative: "CLAUDE.md",                      projectOnly: true },
    { src: ".claude/CLAUDE.md",              destRelative: ".claude/CLAUDE.md",              projectOnly: true },
    { src: "AGENTS.md",                      destRelative: "AGENTS.md",                      projectOnly: true },
    { src: "GEMINI.md",                      destRelative: "GEMINI.md",                      projectOnly: true },
    { src: "minion-contract.md",             destRelative: "minion-contract.md",             projectOnly: true },
    { src: "cybersec-minion-contract.md",    destRelative: "cybersec-minion-contract.md",    projectOnly: true },
    { src: ".mcp.json",                      destRelative: ".mcp.json",                      projectOnly: true },

    // Cybersec agent files (Claude runtime v1)
    { src: ".claude/agents/cybersec/blueteam-coordinator.agent.md",  destRelative: ".claude/agents/cybersec/blueteam-coordinator.agent.md",  projectOnly: true },
    { src: ".claude/agents/cybersec/blueteam-detect.agent.md",       destRelative: ".claude/agents/cybersec/blueteam-detect.agent.md",       projectOnly: true },
    { src: ".claude/agents/cybersec/blueteam-hardening.agent.md",    destRelative: ".claude/agents/cybersec/blueteam-hardening.agent.md",    projectOnly: true },
    { src: ".claude/agents/cybersec/blueteam-incident.agent.md",     destRelative: ".claude/agents/cybersec/blueteam-incident.agent.md",     projectOnly: true },
    { src: ".claude/agents/cybersec/purpleteam-coordinator.agent.md",destRelative: ".claude/agents/cybersec/purpleteam-coordinator.agent.md",projectOnly: true },
    { src: ".claude/agents/cybersec/redteam-coordinator.agent.md",   destRelative: ".claude/agents/cybersec/redteam-coordinator.agent.md",   projectOnly: true },
    { src: ".claude/agents/cybersec/redteam-exploit.agent.md",       destRelative: ".claude/agents/cybersec/redteam-exploit.agent.md",       projectOnly: true },
    { src: ".claude/agents/cybersec/redteam-recon.agent.md",         destRelative: ".claude/agents/cybersec/redteam-recon.agent.md",         projectOnly: true },

    // Cybersec skills (all 5 bundles — full harness)
    { src: ".claude/skills/cybersec-audit/SKILL.md",   destRelative: ".claude/skills/cybersec-audit/SKILL.md",   projectOnly: true },
    { src: ".claude/skills/redteam-attack/SKILL.md",   destRelative: ".claude/skills/redteam-attack/SKILL.md",   projectOnly: true },
    { src: ".claude/skills/blueteam-defense/SKILL.md", destRelative: ".claude/skills/blueteam-defense/SKILL.md", projectOnly: true },
    { src: ".claude/skills/threat-modeling/SKILL.md",  destRelative: ".claude/skills/threat-modeling/SKILL.md",  projectOnly: true },
    { src: ".claude/skills/purple-loop/SKILL.md",      destRelative: ".claude/skills/purple-loop/SKILL.md",      projectOnly: true },
    { src: ".claude/skills/purple-loop/_pl/SKILL.md",  destRelative: ".claude/skills/purple-loop/_pl/SKILL.md",  projectOnly: true },

    // Skill registry
    { src: ".atl/skill-registry.md", destRelative: ".atl/skill-registry.md", projectOnly: true },
  ];

  const gruBase = scope === "global" ? path.join(home, ".gru") : path.join(cwd, ".gru");

  return entries
    .filter((e) => !(scope === "global" && e.projectOnly))
    .map((e) => {
      let dest: string;
      if (e.destRelative.startsWith(".gru/")) {
        // .gru/ files go to the gru root (home or cwd depending on scope)
        dest = path.join(gruBase, e.destRelative.slice(".gru/".length));
      } else {
        // All other files always go to cwd
        dest = path.join(cwd, e.destRelative);
      }
      return { src: e.src, dest };
    });
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

  // 2. Locate templates
  const templatesDir = resolveTemplatesDir();

  // 3. Build file manifest
  const manifest = buildManifest(scope, cwd, home);

  // 4. Scaffold each file
  const files: FileResult[] = [];
  for (const { src, dest } of manifest) {
    // Determine status correctly: check existence before copy
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

    // When overwriting an existing file under --force, write a sibling backup
    // (<file>.bak) before clobbering so the user can recover their original.
    if (existed && force) {
      fs.copyFileSync(dest, `${dest}.bak`);
    }

    fs.copyFileSync(srcPath, dest);
    files.push({ dest, status: existed && force ? "overwritten" : "created" });
  }

  return { scope, files };
}

// ---------------------------------------------------------------------------
// CLI output formatter
// ---------------------------------------------------------------------------

export function printInitSummary(result: InitResult): void {
  const { scope, files } = result;

  const created    = files.filter((f) => f.status === "created");
  const skipped    = files.filter((f) => f.status === "skipped");
  const overwritten = files.filter((f) => f.status === "overwritten");

  console.log(`\ngru init — scope: ${scope.toUpperCase()}\n`);

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
