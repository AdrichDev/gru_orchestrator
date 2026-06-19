#!/usr/bin/env node
/**
 * generate-harness.mjs
 *
 * Reads AGENTS.md (the hand-edited canonical harness doc) and writes all
 * generated runtime targets and their templates/ mirrors.
 *
 * Root CLAUDE.md, AGENTS.md, GEMINI.md are byte-identical to the canonical
 * (shared header, no asymmetric GENERATED marker). They are NOT in TARGETS —
 * they are maintained as direct copies of AGENTS.md. Claude Code, Codex and
 * Gemini load these root files, so no plain-copy subdir mirrors are generated
 * for them.
 *
 * Generated targets are: the .config/opencode/AGENTS.md live file (OpenCode
 * reads its own config dir, not the repo root), the .cursor/.qwen live files
 * (format-adapted, no root equivalent), and the templates/ mirrors consumed by
 * `gru init` when it scaffolds OTHER projects. All carry the GENERATED header.
 *
 * Usage:   node scripts/generate-harness.mjs
 * npm:     pnpm harness:gen
 *
 * Idempotent — safe to run multiple times.
 * Dependency-free — uses only Node built-ins (fs, path, url).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const CANONICAL = path.join(REPO_ROOT, "AGENTS.md");

// ---------------------------------------------------------------------------
// Header inserted as first non-blank line of every generated file
// ---------------------------------------------------------------------------

export const GENERATED_HEADER =
  "<!-- GENERATED FROM AGENTS.md — DO NOT EDIT. Run: pnpm harness:gen -->";

// ---------------------------------------------------------------------------
// Read canonical source
// ---------------------------------------------------------------------------

function readCanonical() {
  if (!fs.existsSync(CANONICAL)) {
    throw new Error(`Canonical source not found: ${CANONICAL}`);
  }
  return fs.readFileSync(CANONICAL, "utf8");
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeFile(filePath, content) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`  wrote: ${path.relative(REPO_ROOT, filePath)}`);
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

/**
 * Strip the canonical shared header comment line.
 *
 * AGENTS.md (the canonical) starts with an HTML comment that says
 * "Edit AGENTS.md, then run: pnpm harness:gen". Generated subdir/template
 * targets must NOT carry that claim — they are outputs. Strip that comment
 * line and replace it with the GENERATED_HEADER in the caller.
 */
export function stripCanonicalHeader(content) {
  const lines = content.split("\n");
  // Remove the canonical shared header comment (the <!-- ... --> first line).
  const isSharedHeader = (line) =>
    /^<!--.*Canonical harness instruction.*-->/.test(line.trim());
  return lines.filter((line) => !isSharedHeader(line)).join("\n");
}

/**
 * Plain copy: strip the canonical-only header, then prepend the GENERATED
 * header as the first line.
 */
export function plainCopy(content) {
  return GENERATED_HEADER + "\n" + stripCanonicalHeader(content);
}

/**
 * Cursor .mdc adapter:
 *   1. Prepend YAML frontmatter (alwaysApply: true).
 *   2. Add the GENERATED marker as an HTML comment after the frontmatter block.
 *   3. Body = full canonical content (kernel sections already oriented for this).
 *
 * The .mdc format already carries all 19 R5 imperatives from the canonical.
 */
export function cursorMdcAdapter(content) {
  const frontmatter = "---\ndescription: Gru harness\nalwaysApply: true\n---\n";
  return frontmatter + GENERATED_HEADER + "\n" + stripCanonicalHeader(content);
}

/**
 * QWEN adapter:
 *   1. Strip voseo verb forms (safety net — canonical is EN so typically no-ops).
 *   2. Prepend the GENERATED header.
 *
 * Voseo forms to strip: tenés, hacés, podés, sabés, venís, querés, sos, vas,
 * estás (when it follows "vos"), and the pronoun "vos" (standalone).
 */
export function qwenAdapter(content) {
  let out = stripCanonicalHeader(content);
  // Verb form replacements (Argentine/Rioplatense voseo → tuteo)
  const voseoReplacements = [
    [/\btenés\b/g, "tienes"],
    [/\bhacés\b/g, "haces"],
    [/\bpodés\b/g, "puedes"],
    [/\bsabés\b/g, "sabes"],
    [/\bvenís\b/g, "vienes"],
    [/\bquerés\b/g, "quieres"],
    [/\bsos\b/g, "eres"],
    [/\bvos\b/g, "tú"],
  ];
  for (const [pattern, replacement] of voseoReplacements) {
    out = out.replace(pattern, replacement);
  }
  return GENERATED_HEADER + "\n" + out;
}

// ---------------------------------------------------------------------------
// Single source of generation truth: adapter kind → transform fn
// ---------------------------------------------------------------------------

/**
 * Map of adapter kind → pure transform(canonicalContent) → fileContent.
 * This is the ONLY place generation logic lives. The CLI and the drift test
 * both consume it.
 */
export const ADAPTERS = {
  plainCopy,
  cursorMdcAdapter,
  qwenAdapter,
};

/**
 * Pure transform: given canonical content and a target kind, return the exact
 * string written to disk for that target (GENERATED marker + canonical-header
 * strip included).
 */
export function transform(canonical, kind) {
  const adapter = ADAPTERS[kind];
  if (!adapter) {
    throw new Error(`Unknown adapter kind: ${kind}`);
  }
  return adapter(canonical);
}

// ---------------------------------------------------------------------------
// Target definitions — each target: { dest (absolute), kind (adapter key) }
// ---------------------------------------------------------------------------

const TEMPLATES = path.join(REPO_ROOT, "templates");

/**
 * Single list of every GENERATED target (subdir live copies + template mirrors).
 * `dest` is the absolute output path; `kind` selects the transform.
 *
 * Root CLAUDE.md, AGENTS.md, GEMINI.md are byte-identical to the canonical
 * (same shared header) and are NOT in this list — they are direct copies of
 * AGENTS.md, not generated outputs. Maintain them by copying AGENTS.md directly
 * or by running `pnpm harness:gen` (which also syncs them via the copy step in main()).
 */
export const TARGETS = [
  // NOTE: plain-copy subdir LIVE files for Claude / Codex / Gemini
  // (.claude/CLAUDE.md, .codex/AGENTS.md, .gemini/GEMINI.md) are intentionally
  // NOT generated. Those runtimes read the canonical file from the repo root
  // (CLAUDE.md / AGENTS.md / GEMINI.md), so the subdir copies were pure
  // duplication. The templates/ mirrors below are kept because `gru init`
  // copies them when scaffolding OTHER projects.
  //
  // OpenCode is the exception: it resolves its instructions from
  // .config/opencode/AGENTS.md and is not guaranteed to read the repo-root
  // AGENTS.md, so this one subdir live copy is kept explicitly.
  { dest: path.join(REPO_ROOT, ".config", "opencode", "AGENTS.md"), kind: "plainCopy" },
  // Format-adapted live file (no root equivalent — Cursor reads .cursor/rules/*)
  { dest: path.join(REPO_ROOT, ".cursor", "rules", "gru.mdc"),      kind: "cursorMdcAdapter" },
  // QWEN live file
  { dest: path.join(REPO_ROOT, ".qwen", "QWEN.md"),                 kind: "qwenAdapter" },
  // Plain-copy template mirrors (carry GENERATED header)
  { dest: path.join(TEMPLATES, "CLAUDE.md"),                        kind: "plainCopy" },
  { dest: path.join(TEMPLATES, "AGENTS.md"),                        kind: "plainCopy" },
  { dest: path.join(TEMPLATES, "GEMINI.md"),                        kind: "plainCopy" },
  { dest: path.join(TEMPLATES, ".claude", "CLAUDE.md"),             kind: "plainCopy" },
  { dest: path.join(TEMPLATES, ".codex", "AGENTS.md"),              kind: "plainCopy" },
  { dest: path.join(TEMPLATES, ".gemini", "GEMINI.md"),             kind: "plainCopy" },
  { dest: path.join(TEMPLATES, ".config", "opencode", "AGENTS.md"), kind: "plainCopy" },
  // Format-adapted template mirror
  { dest: path.join(TEMPLATES, ".cursor", "rules", "gru.mdc"),      kind: "cursorMdcAdapter" },
];

export { REPO_ROOT, CANONICAL, readCanonical };

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log("harness:gen — reading canonical source...");
  const canonical = readCanonical();
  console.log(`  source: ${path.relative(REPO_ROOT, CANONICAL)} (${canonical.split("\n").length} lines)`);

  // Step 1: Sync root byte-identical copies (CLAUDE.md, GEMINI.md = AGENTS.md exactly).
  // These three must always be byte-identical — no GENERATED header, same shared header.
  const ROOT_COPIES = [
    path.join(REPO_ROOT, "CLAUDE.md"),
    path.join(REPO_ROOT, "GEMINI.md"),
  ];
  console.log("\nSyncing root byte-identical copies...");
  for (const dest of ROOT_COPIES) {
    writeFile(dest, canonical);
  }

  // Step 2: Write generated subdir/template targets.
  console.log(`\nWriting ${TARGETS.length} generated targets...`);
  for (const { dest, kind } of TARGETS) {
    const content = transform(canonical, kind);
    writeFile(dest, content);
  }

  console.log(`\nDone. 2 root copies + ${TARGETS.length} generated targets from AGENTS.md.`);
}

// CLI guard: only write files when executed directly, not when imported.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
