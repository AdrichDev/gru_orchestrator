/**
 * harness-drift.test.ts
 *
 * Drift-check: regenerates all harness targets in-memory and compares them
 * against the committed files on disk. Fails with an actionable message
 * naming the divergent file if any drift is detected.
 *
 * A drift means either:
 *   (a) Someone hand-edited a generated file (R1 violation), OR
 *   (b) harness/GRU.md was updated but `pnpm harness:gen` was not run (R3).
 *
 * Fix: run `pnpm harness:gen` from the repo root.
 */

import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  GENERATED_HEADER,
  REPO_ROOT,
  CANONICAL,
  TARGETS,
  transform,
  readCanonical,
} from "../scripts/generate-harness.mjs";

// ---------------------------------------------------------------------------
// Single source of generation truth: import the generator's transform + target
// list directly. Importing the script does NOT write files (CLI guard).
// ---------------------------------------------------------------------------

const CANONICAL_PATH = CANONICAL;

function buildExpectedTargets(
  canonical: string
): Array<{ rel: string; expected: string }> {
  return TARGETS.map(({ dest, kind }) => ({
    rel: path.relative(REPO_ROOT, dest),
    expected: transform(canonical, kind),
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("harness drift check", () => {
  test("harness/GRU.md canonical source must exist", () => {
    expect(
      fs.existsSync(CANONICAL_PATH),
      `MISSING: harness/GRU.md not found. Create it and run pnpm harness:gen.`
    ).toBe(true);
  });

  test("all generated targets match harness/GRU.md (no drift)", () => {
    if (!fs.existsSync(CANONICAL_PATH)) {
      // Guard — previous test already failed; skip this one cleanly.
      return;
    }

    const canonical = readCanonical();
    const targets = buildExpectedTargets(canonical);

    const drifted: string[] = [];

    for (const { rel, expected } of targets) {
      const absPath = path.join(REPO_ROOT, rel);

      if (!fs.existsSync(absPath)) {
        drifted.push(
          `DRIFT: ${rel} does not exist — run \`pnpm harness:gen\` to create it.`
        );
        continue;
      }

      const actual = fs.readFileSync(absPath, "utf8");
      if (actual !== expected) {
        drifted.push(
          `DRIFT: ${rel} diverges from harness/GRU.md — run \`pnpm harness:gen\` to fix.`
        );
      }
    }

    if (drifted.length > 0) {
      throw new Error(
        `\n${drifted.length} generated file(s) have drifted from harness/GRU.md:\n\n` +
          drifted.map((d) => `  - ${d}`).join("\n") +
          "\n\nFix: run `pnpm harness:gen` from the repo root."
      );
    }
  });

  test(".cursor/rules/gru.mdc starts with alwaysApply: true frontmatter", () => {
    const mdcPath = path.join(REPO_ROOT, ".cursor", "rules", "gru.mdc");
    expect(
      fs.existsSync(mdcPath),
      `MISSING: .cursor/rules/gru.mdc — run pnpm harness:gen`
    ).toBe(true);
    const content = fs.readFileSync(mdcPath, "utf8");
    expect(content).toContain("alwaysApply: true");
  });

  test("all plain-copy targets carry the GENERATED header as first content line", () => {
    const plainTargets = TARGETS.filter(({ kind }) => kind === "plainCopy").map(
      ({ dest }) => dest
    );

    for (const absPath of plainTargets) {
      const rel = path.relative(REPO_ROOT, absPath);
      expect(
        fs.existsSync(absPath),
        `MISSING: ${rel} — run pnpm harness:gen`
      ).toBe(true);
      const firstLine = fs.readFileSync(absPath, "utf8").split("\n")[0];
      expect(firstLine, `${rel} should start with GENERATED header`).toBe(
        GENERATED_HEADER
      );
    }
  });

  test("canonical harness/GRU.md contains GRU and HARNESS keywords", () => {
    const content = fs.readFileSync(CANONICAL_PATH, "utf8");
    expect(content).toContain("GRU");
    expect(content).toContain("HARNESS");
  });
});
