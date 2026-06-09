/**
 * context-guard.cjs
 * PreToolUse hook for Read tool.
 * Blocks inline reads of large files (> LINE_THRESHOLD lines, no offset/limit).
 * Forces delegation to cavecrew-investigator for compressed summary.
 *
 * Exit 0 → allow read
 * Exit 2 → block read (Claude Code surfaces stderr to model)
 */

"use strict";

const fs = require("fs");

const LINE_THRESHOLD = 500;

let toolInput = {};
try {
  toolInput = JSON.parse(process.env.HOOK_TOOL_INPUT || "{}");
} catch (_) {}

const filePath = toolInput.file_path || "";

// Partial reads (with offset or limit) are always allowed — caller knows what they need
if (toolInput.offset !== undefined || toolInput.limit !== undefined) {
  process.exit(0);
}

// Non-existent files → let Read handle the error
if (!filePath || !fs.existsSync(filePath)) {
  process.exit(0);
}

let lineCount = 0;
try {
  const content = fs.readFileSync(filePath, "utf8");
  lineCount = content.split("\n").length;
} catch (_) {
  process.exit(0);
}

if (lineCount > LINE_THRESHOLD) {
  process.stderr.write(
    [
      `CONTEXT-GUARD BLOCK: ${filePath} (${lineCount} lines > ${LINE_THRESHOLD} threshold)`,
      ``,
      `Do NOT read this file inline — it inflates context by ~${lineCount} lines.`,
      ``,
      `ACTION: Delegate to cavecrew-investigator subagent instead.`,
      `PROMPT TO USE:`,
      `  "Read ${filePath}. Return caveman summary only:`,
      `   FILE: <path> (<N> lines)`,
      `   PURPOSE: <one sentence>`,
      `   EXPORTS: <TypeA, funcB, ConstC>`,
      `   KEY_TYPES: <interface/type signatures, key fields only>`,
      `   DECISIONS: <L42: notable logic; L88: guard condition>`,
      `   DEPS: <./foo, ./bar, external-lib>"`,
      ``,
      `Use: Agent({ subagent_type: "caveman:cavecrew-investigator", prompt: <above> })`,
    ].join("\n")
  );
  process.exit(2);
}

process.exit(0);
