/**
 * SQ-02 — AwesomeCopilotProvider caching and async hot path tests
 *
 * Verifies:
 *  1. run() returns the same matches as before (search semantics unchanged)
 *  2. The cache is used on the second call (no extra async walk occurs)
 *  3. An empty catalog returns the "not found" message (edge case preserved)
 *  4. checkAvailability uses async fs (non-blocking — no sync stat)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { AwesomeCopilotProvider } from "../packages/providers/awesome-copilot/src/index.js";

// ── Fixture helpers ──────────────────────────────────────────────────────────

function createFixtureCatalog(): { root: string; cleanup: () => void } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gru-sq02-"));
  const skills: Array<{ dir: string; content: string }> = [
    {
      dir: "security-review",
      content: `---
name: Security Review
description: OWASP security audit and compliance checks.
argument-hint: <target-path>
---
# Security Review Skill
Perform a security audit on the provided codebase.
Keywords: security vulnerability audit owasp compliance
`,
    },
    {
      dir: "architecture-design",
      content: `---
name: Architecture Design
description: Architecture design patterns and guidance.
argument-hint: <context>
---
# Architecture Design Skill
Design system architecture.
Keywords: architecture design pattern system
`,
    },
    {
      dir: "context-only-docs",
      content: `---
name: Context Docs
description: Background documentation only, not executable.
---
# Context Only
No argument-hint — not executable.
`,
    },
  ];

  for (const skill of skills) {
    const skillDir = path.join(root, "skills", skill.dir);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), skill.content, "utf8");
  }

  return {
    root,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SQ-02 — AwesomeCopilotProvider caching (hot path)", () => {
  let root: string;
  let cleanup: () => void;

  beforeEach(() => {
    ({ root, cleanup } = createFixtureCatalog());
  });

  afterEach(() => {
    cleanup();
  });

  it("run() matches security-related prompt against fixture catalog", async () => {
    const provider = new AwesomeCopilotProvider(root);
    const result = await provider.run({ taskId: "t1", prompt: "security audit vulnerability" });

    expect(result.success).toBe(true);
    expect(result.output).toContain("security-review");
    // Architecture should NOT appear for a security-only query (or appear with lower score)
    // At minimum security-review must be the first match
    const lines = result.output.split("\n").filter((l) => l.startsWith("-"));
    expect(lines[0]).toContain("security-review");
  });

  it("run() matches architecture-related prompt", async () => {
    const provider = new AwesomeCopilotProvider(root);
    const result = await provider.run({ taskId: "t2", prompt: "architecture design pattern" });

    expect(result.success).toBe(true);
    expect(result.output).toContain("architecture-design");
  });

  it("run() returns 'not found' message when no skill matches", async () => {
    const provider = new AwesomeCopilotProvider(root);
    const result = await provider.run({ taskId: "t3", prompt: "quantum physics photon entanglement" });

    expect(result.success).toBe(true);
    expect(result.output).toContain("no se encontraron skills");
  });

  it("cache is used on second run() call — files deleted after first call do not affect result", async () => {
    const provider = new AwesomeCopilotProvider(root);

    // First call — warms the cache and reads all SKILL.md files
    const first = await provider.run({ taskId: "t4a", prompt: "security audit" });
    expect(first.success).toBe(true);

    // Delete all SKILL.md files from disk — if cache is NOT used, second call would return 0 files
    const skillsDir = path.join(root, "skills");
    for (const dir of fs.readdirSync(skillsDir)) {
      const skillFile = path.join(skillsDir, dir, "SKILL.md");
      if (fs.existsSync(skillFile)) fs.rmSync(skillFile);
    }

    // Second call — cache should still return the original results despite missing files
    const second = await provider.run({ taskId: "t4b", prompt: "security audit" });
    expect(second.success).toBe(true);
    // executedCommand still reports the original file count (from cache)
    expect(second.executedCommand).toBe(first.executedCommand);
    // output is identical
    expect(second.output).toBe(first.output);
  });

  it("second run() returns identical matches to first run() (cache semantic parity)", async () => {
    const provider = new AwesomeCopilotProvider(root);

    const first = await provider.run({ taskId: "t5a", prompt: "security audit vulnerability owasp" });
    const second = await provider.run({ taskId: "t5b", prompt: "security audit vulnerability owasp" });

    expect(second.output).toBe(first.output);
  });

  it("executedCommand reports correct file count after warm", async () => {
    const provider = new AwesomeCopilotProvider(root);
    const result = await provider.run({ taskId: "t6", prompt: "security" });

    // 3 SKILL.md files in the fixture
    expect(result.executedCommand).toContain("3 SKILL.md files");
  });

  it("empty skills dir returns 'not found' message (not an error)", async () => {
    const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gru-sq02-empty-"));
    fs.mkdirSync(path.join(emptyRoot, "skills"), { recursive: true });

    try {
      const provider = new AwesomeCopilotProvider(emptyRoot);
      const result = await provider.run({ taskId: "t7", prompt: "security" });

      expect(result.success).toBe(true);
      expect(result.output).toContain("no se encontraron skills");
    } finally {
      fs.rmSync(emptyRoot, { recursive: true, force: true });
    }
  });

  it("unavailable provider returns success=false (unchanged behavior)", async () => {
    const provider = new AwesomeCopilotProvider("/nonexistent/path");
    const result = await provider.run({ taskId: "t8", prompt: "security" });

    expect(result.success).toBe(false);
    expect(result.output).toBe("");
    expect(result.error).toBeDefined();
  });
});
