#!/usr/bin/env node
/**
 * generate-harness.mjs
 *
 * Reads harness/GRU.md (the ONLY hand-edited harness doc) and writes all
 * generated runtime targets and their templates/ mirrors.
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
const CANONICAL = path.join(REPO_ROOT, "harness", "GRU.md");

// ---------------------------------------------------------------------------
// Header inserted as first non-blank line of every generated file
// ---------------------------------------------------------------------------

export const GENERATED_HEADER =
  "<!-- GENERATED FROM harness/GRU.md — DO NOT EDIT. Run: pnpm harness:gen -->";

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
 * Strip the canonical-only header comment block.
 *
 * harness/GRU.md leads with identity comment lines. Some of those assert that
 * THIS file is the canonical source and must be hand-edited. Generated targets
 * must NOT carry that claim — they are outputs. Drop the contiguous leading
 * `#`-comment lines that assert canonical/hand-edit/regenerate semantics, while
 * preserving the `# GRU — ... HARNESS` title and the `# Format:` / `# Version:`
 * identity lines.
 */
export function stripCanonicalHeader(content) {
  const lines = content.split("\n");
  const isCanonicalClaim = (line) =>
    /^#/.test(line) &&
    /CANONICAL SOURCE|hand-edited|regenerate all targets|DO NOT hand-edit|generated outputs/i.test(
      line,
    );
  const filtered = lines.filter((line) => !isCanonicalClaim(line));
  // Collapse a now-empty trailing `#` line left dangling before the blank/`---`.
  return filtered
    .filter((line, i) => !(line.trim() === "#" && (filtered[i + 1] ?? "").trim() === ""))
    .join("\n");
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
 * Single list of every generated target (live + template mirrors).
 * `dest` is the absolute output path; `kind` selects the transform.
 */
export const TARGETS = [
  // Plain-copy live files
  { dest: path.join(REPO_ROOT, "CLAUDE.md"),                        kind: "plainCopy" },
  { dest: path.join(REPO_ROOT, "AGENTS.md"),                        kind: "plainCopy" },
  { dest: path.join(REPO_ROOT, "GEMINI.md"),                        kind: "plainCopy" },
  { dest: path.join(REPO_ROOT, ".claude", "CLAUDE.md"),             kind: "plainCopy" },
  { dest: path.join(REPO_ROOT, ".codex", "AGENTS.md"),              kind: "plainCopy" },
  { dest: path.join(REPO_ROOT, ".gemini", "GEMINI.md"),             kind: "plainCopy" },
  { dest: path.join(REPO_ROOT, ".config", "opencode", "AGENTS.md"), kind: "plainCopy" },
  // Format-adapted live file
  { dest: path.join(REPO_ROOT, ".cursor", "rules", "gru.mdc"),      kind: "cursorMdcAdapter" },
  // QWEN live file
  { dest: path.join(REPO_ROOT, ".qwen", "QWEN.md"),                 kind: "qwenAdapter" },
  // Plain-copy template mirrors
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

  console.log(`\nWriting ${TARGETS.length} targets...`);

  for (const { dest, kind } of TARGETS) {
    const content = transform(canonical, kind);
    writeFile(dest, content);
  }

  console.log(`\nDone. ${TARGETS.length} files generated from harness/GRU.md.`);
}

// CLI guard: only write files when executed directly, not when imported.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
