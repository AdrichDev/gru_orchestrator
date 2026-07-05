import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

// These tests read real project config files. They are contract tests:
// if the config drifts to an invalid state, these tests fail immediately.
//
// Root discovery: walk up from __dirname looking for the sentinel .mcp.json.
// This is location-independent — depth is NOT hardcoded, so it works whether
// the package lives in the monorepo (5 levels deep) or is relocated/published.

function findProjectRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, ".mcp.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      // Filesystem root reached without finding sentinel — fall back to startDir.
      // Tests that require the sentinel will fail with a clear message via beforeAll.
      return startDir;
    }
    dir = parent;
  }
}

const ROOT = findProjectRoot(__dirname);
const MCP_JSON = path.join(ROOT, ".mcp.json");
const SETTINGS_JSON = path.join(ROOT, ".claude", "settings.json");

// ── R2: .claude/settings.json permissions ────────────────────────────────────

describe(".claude/settings.json — MCP permissions (R2)", () => {
  let settings: { permissions?: { allow?: string[] } };

  beforeAll(() => {
    expect(fs.existsSync(SETTINGS_JSON)).toBe(true);
    settings = JSON.parse(fs.readFileSync(SETTINGS_JSON, "utf-8")) as typeof settings;
  });

  it("no wildcard MCP allow rules (mcp__*:*)", () => {
    const allow = settings.permissions?.allow ?? [];
    const wildcards = allow.filter((r) => /mcp__.*:\*$/.test(r));
    expect(wildcards).toHaveLength(0);
  });

  it("MCP allow rules follow explicit format mcp__<server>__<tool>", () => {
    const allow = settings.permissions?.allow ?? [];
    const mcpRules = allow.filter((r) => r.startsWith("mcp__"));
    for (const rule of mcpRules) {
      expect(rule).toMatch(/^mcp__[a-z][a-z0-9-]*__[a-z][a-z0-9_-]*$/);
    }
  });
});
