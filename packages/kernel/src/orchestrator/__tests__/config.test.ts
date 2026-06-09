import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

// These tests read real project config files. They are contract tests:
// if the config drifts to an invalid state, these tests fail immediately.

const ROOT = path.resolve(__dirname, "../../../../../");
const MCP_JSON = path.join(ROOT, ".mcp.json");
const SETTINGS_JSON = path.join(ROOT, ".claude", "settings.json");

// ── R1: .mcp.json MCP startup ─────────────────────────────────────────────────

describe(".mcp.json — Ruflo MCP startup (R1)", () => {
  let mcpConfig: Record<string, unknown>;

  beforeAll(() => {
    expect(fs.existsSync(MCP_JSON)).toBe(true);
    mcpConfig = JSON.parse(fs.readFileSync(MCP_JSON, "utf-8")) as Record<string, unknown>;
  });

  it("claude-flow server uses pnpm command", () => {
    const servers = mcpConfig.mcpServers as Record<string, { command: string; args: string[] }>;
    expect(servers["claude-flow"].command).toBe("pnpm");
  });

  it("claude-flow args[0] is dlx", () => {
    const servers = mcpConfig.mcpServers as Record<string, { command: string; args: string[] }>;
    expect(servers["claude-flow"].args[0]).toBe("dlx");
  });

  it("claude-flow args contain ruflo", () => {
    const servers = mcpConfig.mcpServers as Record<string, { command: string; args: string[] }>;
    const joined = servers["claude-flow"].args.join(" ");
    expect(joined).toContain("ruflo");
  });

  it("claude-flow does not use npx", () => {
    const servers = mcpConfig.mcpServers as Record<string, { command: string; args: string[] }>;
    const cf = servers["claude-flow"];
    expect(cf.command).not.toBe("npx");
    expect(cf.args).not.toContain("npx");
  });
});

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
