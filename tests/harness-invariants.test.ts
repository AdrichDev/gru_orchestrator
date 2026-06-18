/**
 * harness-invariants.test.ts
 *
 * B0 Gate: asserts that every imperative anchor phrase from R5 (the 19
 * required imperatives) is present in harness/GRU.md.
 *
 * This test MUST be green before any Slice B (kernel/reference split) work
 * begins. After the split it MUST remain green — proving no imperative
 * was moved out of the kernel.
 *
 * On failure the test names the exact missing anchor phrase so the developer
 * knows what was accidentally removed.
 */

import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const CANONICAL = path.join(REPO_ROOT, "harness", "GRU.md");

// ---------------------------------------------------------------------------
// The 19 R5 imperative anchors — one stable, concrete string per imperative.
// These strings must remain in harness/GRU.md forever (kernel invariants).
// If a string is missing here, the task spec (R5) requires adding/restoring it
// to harness/GRU.md — NOT relaxing the anchor.
// ---------------------------------------------------------------------------

const IMPERATIVES: Array<{ id: string; anchor: string }> = [
  {
    id: "R5-1 BOOTSTRAP",
    anchor: "BOOTSTRAP CONTEXT",
  },
  {
    id: "R5-1 MANDATORY SKILL CHECK",
    anchor: "MANDATORY SKILL CHECK",
  },
  {
    id: "R5-2 ACTION LIMITS",
    anchor: "## ACTION LIMITS",
  },
  {
    id: "R5-3 STEP 0 FILESYSTEM SCAN",
    anchor: "## STEP 0 — FILESYSTEM SCAN (MANDATORY)",
  },
  {
    id: "R5-4 DELEGATION RULES",
    anchor: "## DELEGATION RULES",
  },
  {
    id: "R5-5 SUB-AGENT DEDUP",
    anchor: "Deduplication in Sub-Agent Launches",
  },
  {
    id: "R5-6 SUB-AGENT STARTUP PATTERN",
    anchor: "### Sub-Agent Startup Pattern",
  },
  {
    id: "R5-7 SUB-AGENT CONTEXT PROTOCOL",
    anchor: "### Sub-Agent Context Protocol",
  },
  {
    id: "R5-8 COMPLEXITY + RISK TABLES",
    anchor: "### Complexity Evaluation",
  },
  {
    id: "R5-9 DYNAMIC RECLASSIFICATION",
    anchor: "## DYNAMIC RECLASSIFICATION",
  },
  {
    id: "R5-10 GUARDRAILS",
    anchor: "## GUARDRAILS",
  },
  {
    id: "R5-11 HUMAN-IN-THE-LOOP",
    anchor: "## HUMAN-IN-THE-LOOP",
  },
  {
    id: "R5-12 ENGRAM CONSULT/SAVE TRIGGERS",
    anchor: "## MEMORY WITH ENGRAM — CONSULT/SAVE TRIGGERS",
  },
  {
    id: "R5-13 RUFLO ESCALATION CONDITIONS",
    anchor: "## RUFLO ESCALATION CONDITIONS",
  },
  {
    id: "R5-14 CYBERSEC ACTIVATION + LOOP",
    anchor: "RECON → EXPLOIT → ASSESS → HARDEN → DETECT → REAUDIT → LEARN",
  },
  {
    id: "R5-15 MODEL ROUTING",
    anchor: "## MODEL ROUTING",
  },
  {
    id: "R5-16 PERSONA SCOPE",
    anchor: "### Persona Scope",
  },
  {
    id: "R5-17 ASSISTANT RULES",
    anchor: "### Assistant Rules",
  },
  {
    id: "R5-18 CONTEXTUAL SKILL LOADING (MANDATORY)",
    anchor: "### Contextual Skill Loading (MANDATORY)",
  },
  {
    id: "R5-19 PROTOCOLO: RESUMEN DE SCOPE",
    anchor: "## PROTOCOLO: RESUMEN DE SCOPE",
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("harness invariants — R5 imperative anchors", () => {
  test("harness/GRU.md canonical source must exist", () => {
    expect(
      fs.existsSync(CANONICAL),
      `MISSING: harness/GRU.md not found — create it and run pnpm harness:gen`
    ).toBe(true);
  });

  test("all 19 R5 imperative anchor phrases are present in harness/GRU.md", () => {
    if (!fs.existsSync(CANONICAL)) {
      // Guard — previous test already failed; skip this one cleanly.
      return;
    }

    const content = fs.readFileSync(CANONICAL, "utf8");
    const missing: string[] = [];

    for (const { id, anchor } of IMPERATIVES) {
      if (!content.includes(anchor)) {
        missing.push(`MISSING: '${anchor}' (${id}) not found in harness/GRU.md`);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `\n${missing.length} imperative anchor(s) are absent from harness/GRU.md:\n\n` +
          missing.map((m) => `  - ${m}`).join("\n") +
          "\n\nDo NOT remove these anchors. If you moved explanatory content to" +
          " docs/harness-reference.md, the imperative HEADING must stay in the kernel."
      );
    }
  });

  // Run per-imperative assertions so vitest reports each missing anchor
  // individually in the test reporter — easier to scan than one big error.
  for (const { id, anchor } of IMPERATIVES) {
    test(`[${id}] anchor present: "${anchor}"`, () => {
      if (!fs.existsSync(CANONICAL)) {
        return; // Guard — harness/GRU.md missing, first test handles that.
      }
      const content = fs.readFileSync(CANONICAL, "utf8");
      expect(
        content,
        `MISSING: '${anchor}' (${id}) not found in harness/GRU.md`
      ).toContain(anchor);
    });
  }
});
