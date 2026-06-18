/**
 * Unit tests for apps/cli/src/init.ts
 *
 * Tests cover:
 *   - buildManifest: PROJECT vs GLOBAL scope destinations
 *   - runInit: file creation, idempotency (skip), --force overwrite
 *   - resolveTemplatesDir: finds templates/ dir from the current monorepo layout
 */

import { describe, expect, test, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildManifest,
  runInit,
  resolveTemplatesDir,
  isValidRuntime,
  ALL_RUNTIMES,
  type InstallScope,
  type RuntimeId,
} from "../apps/cli/src/init.js";

const REPO_ROOT = path.resolve(__dirname, "..");
const CLI_BUNDLE = path.join(REPO_ROOT, "dist", "cli.cjs");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// resolveTemplatesDir
// ---------------------------------------------------------------------------

describe("resolveTemplatesDir", () => {
  test("finds templates/ directory with .gru/config.yaml sentinel", () => {
    const dir = resolveTemplatesDir();
    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.existsSync(path.join(dir, ".gru", "config.yaml"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildManifest — scope routing
// ---------------------------------------------------------------------------

describe("buildManifest — project scope", () => {
  test("all .gru/* files go to <cwd>/.gru/", () => {
    const cwd = os.tmpdir();
    const home = os.homedir();
    const manifest = buildManifest("project", cwd, home);

    const gruBase = path.join(cwd, ".gru");
    const gruFiles = manifest.filter((e) => e.dest.startsWith(gruBase));
    expect(gruFiles.length).toBeGreaterThan(0);
    for (const f of gruFiles) {
      expect(f.dest.startsWith(gruBase)).toBe(true);
    }
  });

  test("harness files go to <cwd>/", () => {
    const cwd = os.tmpdir();
    const home = os.homedir();
    const manifest = buildManifest("project", cwd, home);

    const claudeMd = manifest.find(
      (e) => e.dest === path.join(cwd, "CLAUDE.md")
    );
    expect(claudeMd).toBeDefined();
  });

  test("cybersec agent files are included", () => {
    const cwd = os.tmpdir();
    const home = os.homedir();
    const manifest = buildManifest("project", cwd, home);

    const agentBase = path.join(cwd, ".claude", "agents", "cybersec");
    const agentFiles = manifest.filter((e) => e.dest.startsWith(agentBase));
    expect(agentFiles.length).toBe(8);
  });

  test("all 5 cybersec skill bundles are included in manifest", () => {
    const cwd = os.tmpdir();
    const home = os.homedir();
    const manifest = buildManifest("project", cwd, home);

    const expectedSkills = [
      "cybersec-audit",
      "redteam-attack",
      "blueteam-defense",
      "threat-modeling",
      "purple-loop",
    ];

    for (const skillName of expectedSkills) {
      const skill = manifest.find(
        (e) => e.dest.includes(skillName) && e.dest.endsWith("SKILL.md")
      );
      expect(skill, `Expected skill ${skillName} to be in manifest`).toBeDefined();
    }
  });
});

describe("buildManifest — global scope", () => {
  test("GLOBAL: .gru/* files go to ~/.gru/", () => {
    const cwd = os.tmpdir();
    const home = os.homedir();
    const manifest = buildManifest("global", cwd, home);

    const gruBase = path.join(home, ".gru");
    const gruFiles = manifest.filter((e) => e.dest.startsWith(gruBase));
    expect(gruFiles.length).toBeGreaterThan(0);
    for (const f of gruFiles) {
      expect(f.dest.startsWith(gruBase)).toBe(true);
    }
  });

  test("GLOBAL: no cwd harness files (projectOnly entries excluded)", () => {
    const cwd = os.tmpdir();
    const home = os.homedir();
    const manifest = buildManifest("global", cwd, home);

    // None of the manifest entries should go to cwd (all go to home/.gru)
    for (const f of manifest) {
      expect(f.dest.startsWith(cwd)).toBe(false);
    }
  });

  test("GLOBAL: CLAUDE.md and cybersec agents NOT in manifest", () => {
    const cwd = os.tmpdir();
    const home = os.homedir();
    const manifest = buildManifest("global", cwd, home);

    const hasClaude = manifest.some((e) => e.dest.endsWith("CLAUDE.md"));
    const hasCybersecAgent = manifest.some((e) =>
      e.dest.includes("cybersec")
    );
    expect(hasClaude).toBe(false);
    expect(hasCybersecAgent).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// runInit — integration (uses real templates dir from monorepo)
// ---------------------------------------------------------------------------

describe("runInit — project scope", () => {
  let tmpCwd: string;
  let tmpHome: string;

  beforeEach(() => {
    tmpCwd = makeTmpDir("gru-init-test-cwd-");
    tmpHome = makeTmpDir("gru-init-test-home-");
  });

  afterEach(() => {
    cleanDir(tmpCwd);
    cleanDir(tmpHome);
  });

  test("creates .gru/ and harness files from scratch", async () => {
    const result = await runInit({
      scope: "project",
      cwd: tmpCwd,
      home: tmpHome,
    });

    expect(result.scope).toBe("project");

    // .gru/config.yaml should be created
    expect(fs.existsSync(path.join(tmpCwd, ".gru", "config.yaml"))).toBe(true);
    expect(fs.existsSync(path.join(tmpCwd, ".gru", "providers.yaml"))).toBe(true);

    // CLAUDE.md at root
    expect(fs.existsSync(path.join(tmpCwd, "CLAUDE.md"))).toBe(true);

    // A cybersec agent
    expect(
      fs.existsSync(
        path.join(tmpCwd, ".claude", "agents", "cybersec", "blueteam-coordinator.agent.md")
      )
    ).toBe(true);

    // All files should be "created"
    const created = result.files.filter((f) => f.status === "created");
    expect(created.length).toBeGreaterThan(0);
  });

  test("idempotent re-run skips existing files", async () => {
    // First run
    await runInit({ scope: "project", cwd: tmpCwd, home: tmpHome });

    // Second run — no force
    const result2 = await runInit({ scope: "project", cwd: tmpCwd, home: tmpHome });

    const skipped = result2.files.filter((f) => f.status === "skipped");
    const created = result2.files.filter((f) => f.status === "created");
    // All files existed — all should be skipped
    expect(skipped.length).toBeGreaterThan(0);
    expect(created.length).toBe(0);
  });

  test("--force overwrites existing files", async () => {
    // First run
    await runInit({ scope: "project", cwd: tmpCwd, home: tmpHome });

    // Mutate a file to confirm it gets overwritten
    const configPath = path.join(tmpCwd, ".gru", "config.yaml");
    fs.writeFileSync(configPath, "# mutated\n");

    // Second run with force
    const result2 = await runInit({
      scope: "project",
      cwd: tmpCwd,
      home: tmpHome,
      force: true,
    });

    const overwritten = result2.files.filter((f) => f.status === "overwritten");
    expect(overwritten.length).toBeGreaterThan(0);

    // config.yaml should be back to original (not "# mutated")
    const content = fs.readFileSync(configPath, "utf-8");
    expect(content).not.toBe("# mutated\n");
  });

  test("--force creates a .bak backup before overwriting", async () => {
    // First run to create files
    await runInit({ scope: "project", cwd: tmpCwd, home: tmpHome });

    // Write custom content to config.yaml
    const configPath = path.join(tmpCwd, ".gru", "config.yaml");
    const originalContent = "# my-custom-config\n";
    fs.writeFileSync(configPath, originalContent);

    // Run with --force
    await runInit({ scope: "project", cwd: tmpCwd, home: tmpHome, force: true });

    // A .bak file should exist next to config.yaml
    const bakPath = `${configPath}.bak`;
    expect(fs.existsSync(bakPath)).toBe(true);

    // .bak should contain the pre-overwrite content
    const bakContent = fs.readFileSync(bakPath, "utf-8");
    expect(bakContent).toBe(originalContent);
  });

  test("partial scaffold: creates missing, skips existing", async () => {
    // Pre-create one file
    fs.mkdirSync(path.join(tmpCwd, ".gru"), { recursive: true });
    fs.writeFileSync(path.join(tmpCwd, ".gru", "config.yaml"), "# pre-existing");

    const result = await runInit({ scope: "project", cwd: tmpCwd, home: tmpHome });

    const skipped = result.files.filter((f) => f.status === "skipped");
    const created = result.files.filter((f) => f.status === "created");
    // At least one file was skipped (config.yaml)
    expect(skipped.some((f) => f.dest.endsWith("config.yaml"))).toBe(true);
    // Others were created
    expect(created.length).toBeGreaterThan(0);
  });
});

describe("runInit — global scope", () => {
  let tmpCwd: string;
  let tmpHome: string;

  beforeEach(() => {
    tmpCwd = makeTmpDir("gru-init-test-cwd-");
    tmpHome = makeTmpDir("gru-init-test-home-");
  });

  afterEach(() => {
    cleanDir(tmpCwd);
    cleanDir(tmpHome);
  });

  test("GLOBAL scope: writes .gru/ to home, not cwd", async () => {
    const result = await runInit({
      scope: "global",
      cwd: tmpCwd,
      home: tmpHome,
    });

    expect(result.scope).toBe("global");

    // .gru/config.yaml should be at home
    expect(fs.existsSync(path.join(tmpHome, ".gru", "config.yaml"))).toBe(true);

    // No .gru/ in cwd
    expect(fs.existsSync(path.join(tmpCwd, ".gru"))).toBe(false);

    // No harness files in cwd
    expect(fs.existsSync(path.join(tmpCwd, "CLAUDE.md"))).toBe(false);
  });

  test("GLOBAL scope: idempotent", async () => {
    await runInit({ scope: "global", cwd: tmpCwd, home: tmpHome });
    const result2 = await runInit({ scope: "global", cwd: tmpCwd, home: tmpHome });

    const skipped = result2.files.filter((f) => f.status === "skipped");
    expect(skipped.length).toBeGreaterThan(0);
    expect(result2.files.filter((f) => f.status === "created").length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// CLI integration — scope validation and --force backup
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Runtime selection — buildManifest
// ---------------------------------------------------------------------------

describe("buildManifest — runtime selection", () => {
  const cwd = os.tmpdir();
  const home = os.homedir();

  test("default (claude only) includes .claude/ files, not .codex/ or .gemini/", () => {
    const manifest = buildManifest("project", cwd, home, ["claude"]);
    const hasClaude = manifest.some((e) => e.dest.includes(".claude"));
    const hasCodex = manifest.some((e) => e.dest.includes(".codex"));
    const hasGemini = manifest.some((e) => e.dest.includes(".gemini"));
    expect(hasClaude).toBe(true);
    expect(hasCodex).toBe(false);
    expect(hasGemini).toBe(false);
  });

  test("gemini runtime writes .gemini/GEMINI.md, not .claude/ files", () => {
    const manifest = buildManifest("project", cwd, home, ["gemini"]);
    const hasGeminiMd = manifest.some((e) => e.dest.endsWith(".gemini/GEMINI.md".replace(/\//g, path.sep)));
    const hasClaude = manifest.some((e) => e.dest.includes(".claude"));
    expect(hasGeminiMd).toBe(true);
    expect(hasClaude).toBe(false);
  });

  test("codex runtime writes .codex/AGENTS.md and root AGENTS.md", () => {
    const manifest = buildManifest("project", cwd, home, ["codex"]);
    const hasCodexAgents = manifest.some((e) =>
      e.dest.endsWith(path.join(".codex", "AGENTS.md"))
    );
    const hasRootAgents = manifest.some((e) =>
      e.dest === path.join(cwd, "AGENTS.md")
    );
    expect(hasCodexAgents).toBe(true);
    expect(hasRootAgents).toBe(true);
  });

  test("cursor runtime writes .cursor/rules/gru.mdc", () => {
    const manifest = buildManifest("project", cwd, home, ["cursor"]);
    const hasMdc = manifest.some((e) =>
      e.dest.endsWith(path.join(".cursor", "rules", "gru.mdc"))
    );
    expect(hasMdc).toBe(true);
  });

  test("opencode runtime writes .config/opencode/AGENTS.md", () => {
    const manifest = buildManifest("project", cwd, home, ["opencode"]);
    const hasOpencode = manifest.some((e) =>
      e.dest.endsWith(path.join(".config", "opencode", "AGENTS.md"))
    );
    expect(hasOpencode).toBe(true);
  });

  test("antigravity runtime writes root AGENTS.md", () => {
    const manifest = buildManifest("project", cwd, home, ["antigravity"]);
    const hasRootAgents = manifest.some((e) =>
      e.dest === path.join(cwd, "AGENTS.md")
    );
    expect(hasRootAgents).toBe(true);
  });

  test("shared files always written regardless of runtime", () => {
    for (const runtime of ALL_RUNTIMES) {
      const manifest = buildManifest("project", cwd, home, [runtime]);
      const hasConfig = manifest.some((e) => e.dest.endsWith("config.yaml"));
      const hasMcp = manifest.some((e) => e.dest.endsWith(".mcp.json"));
      expect(hasConfig, `config.yaml missing for runtime ${runtime}`).toBe(true);
      expect(hasMcp, `.mcp.json missing for runtime ${runtime}`).toBe(true);
    }
  });

  test("all runtimes: AGENTS.md deduped — appears once even though codex+cursor+antigravity all want it", () => {
    const manifest = buildManifest("project", cwd, home, ["codex", "cursor", "antigravity"]);
    const rootAgentsEntries = manifest.filter(
      (e) => e.dest === path.join(cwd, "AGENTS.md")
    );
    expect(rootAgentsEntries.length).toBe(1);
  });

  test("--runtime all includes all runtimes", () => {
    const manifest = buildManifest("project", cwd, home, [...ALL_RUNTIMES]);
    const hasClaude = manifest.some((e) => e.dest.includes(".claude"));
    const hasCodex = manifest.some((e) => e.dest.includes(".codex"));
    const hasGemini = manifest.some((e) => e.dest.includes(".gemini"));
    const hasCursor = manifest.some((e) => e.dest.includes(".cursor"));
    const hasOpencode = manifest.some((e) => e.dest.includes(path.join(".config", "opencode")));
    expect(hasClaude).toBe(true);
    expect(hasCodex).toBe(true);
    expect(hasGemini).toBe(true);
    expect(hasCursor).toBe(true);
    expect(hasOpencode).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isValidRuntime
// ---------------------------------------------------------------------------

describe("isValidRuntime", () => {
  test("returns true for all valid runtimes", () => {
    for (const rt of ALL_RUNTIMES) {
      expect(isValidRuntime(rt)).toBe(true);
    }
  });

  test("returns false for invalid values", () => {
    expect(isValidRuntime("vscode")).toBe(false);
    expect(isValidRuntime("")).toBe(false);
    expect(isValidRuntime("ALL")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// runInit — runtime-aware scaffolding
// ---------------------------------------------------------------------------

describe("runInit — runtime selection", () => {
  let tmpCwd: string;
  let tmpHome: string;

  beforeEach(() => {
    tmpCwd = makeTmpDir("gru-runtime-test-cwd-");
    tmpHome = makeTmpDir("gru-runtime-test-home-");
  });

  afterEach(() => {
    cleanDir(tmpCwd);
    cleanDir(tmpHome);
  });

  test("--runtime cursor creates .cursor/rules/gru.mdc", async () => {
    const result = await runInit({
      scope: "project",
      cwd: tmpCwd,
      home: tmpHome,
      runtimes: ["cursor"],
    });
    const mdcPath = path.join(tmpCwd, ".cursor", "rules", "gru.mdc");
    expect(fs.existsSync(mdcPath)).toBe(true);
    const content = fs.readFileSync(mdcPath, "utf-8");
    expect(content).toContain("alwaysApply: true");
  });

  test("--runtime cursor does NOT create .claude/ files", async () => {
    await runInit({
      scope: "project",
      cwd: tmpCwd,
      home: tmpHome,
      runtimes: ["cursor"],
    });
    expect(fs.existsSync(path.join(tmpCwd, ".claude"))).toBe(false);
  });

  test("--runtime gemini creates .gemini/GEMINI.md", async () => {
    const result = await runInit({
      scope: "project",
      cwd: tmpCwd,
      home: tmpHome,
      runtimes: ["gemini"],
    });
    expect(fs.existsSync(path.join(tmpCwd, ".gemini", "GEMINI.md"))).toBe(true);
    // root GEMINI.md should NOT be present (placed under .gemini/ only)
    expect(fs.existsSync(path.join(tmpCwd, "GEMINI.md"))).toBe(false);
  });

  test("--runtime all writes every runtime", async () => {
    await runInit({
      scope: "project",
      cwd: tmpCwd,
      home: tmpHome,
      runtimes: [...ALL_RUNTIMES],
    });
    // Claude
    expect(fs.existsSync(path.join(tmpCwd, ".claude", "CLAUDE.md"))).toBe(true);
    // Codex
    expect(fs.existsSync(path.join(tmpCwd, ".codex", "AGENTS.md"))).toBe(true);
    // Gemini
    expect(fs.existsSync(path.join(tmpCwd, ".gemini", "GEMINI.md"))).toBe(true);
    // Cursor
    expect(fs.existsSync(path.join(tmpCwd, ".cursor", "rules", "gru.mdc"))).toBe(true);
    // OpenCode
    expect(fs.existsSync(path.join(tmpCwd, ".config", "opencode", "AGENTS.md"))).toBe(true);
    // Shared
    expect(fs.existsSync(path.join(tmpCwd, ".gru", "config.yaml"))).toBe(true);
    expect(fs.existsSync(path.join(tmpCwd, ".mcp.json"))).toBe(true);
  });

  test("shared files created for every single-runtime run", async () => {
    for (const runtime of ALL_RUNTIMES) {
      const scopeCwd = makeTmpDir(`gru-shared-${runtime}-`);
      const scopeHome = makeTmpDir(`gru-shared-home-${runtime}-`);
      try {
        await runInit({ scope: "project", cwd: scopeCwd, home: scopeHome, runtimes: [runtime] });
        expect(fs.existsSync(path.join(scopeCwd, ".gru", "config.yaml")),
          `config.yaml missing for ${runtime}`).toBe(true);
        expect(fs.existsSync(path.join(scopeCwd, ".mcp.json")),
          `.mcp.json missing for ${runtime}`).toBe(true);
        expect(fs.existsSync(path.join(scopeCwd, "minion-contract.md")),
          `minion-contract.md missing for ${runtime}`).toBe(true);
      } finally {
        cleanDir(scopeCwd);
        cleanDir(scopeHome);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// CLI integration — --runtime flag validation
// ---------------------------------------------------------------------------

describe("CLI: --runtime flag", () => {
  test("invalid --runtime value exits 2", () => {
    if (!fs.existsSync(CLI_BUNDLE)) {
      throw new Error(`dist/cli.cjs not found at ${CLI_BUNDLE}. Run \`pnpm build\` before tests.`);
    }
    const result = spawnSync(
      process.execPath,
      [CLI_BUNDLE, "init", "--scope", "project", "--runtime", "vscode"],
      { encoding: "utf8", timeout: 10_000 }
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/invalid --runtime value/i);
  });

  test("--runtime cursor --scope project creates .cursor/rules/gru.mdc", { timeout: 15_000 }, () => {
    if (!fs.existsSync(CLI_BUNDLE)) {
      throw new Error(`dist/cli.cjs not found at ${CLI_BUNDLE}.`);
    }
    const tmpCwd = fs.mkdtempSync(path.join(os.tmpdir(), "gru-cursor-cli-"));
    try {
      const result = spawnSync(
        process.execPath,
        [CLI_BUNDLE, "init", "--scope", "project", "--runtime", "cursor"],
        { encoding: "utf8", cwd: tmpCwd, timeout: 15_000 }
      );
      expect(result.status).toBe(0);
      expect(fs.existsSync(path.join(tmpCwd, ".cursor", "rules", "gru.mdc"))).toBe(true);
      expect(fs.existsSync(path.join(tmpCwd, ".claude"))).toBe(false);
    } finally {
      fs.rmSync(tmpCwd, { recursive: true, force: true });
    }
  });

  test("--runtime all --scope project writes all runtimes", { timeout: 20_000 }, () => {
    if (!fs.existsSync(CLI_BUNDLE)) {
      throw new Error(`dist/cli.cjs not found at ${CLI_BUNDLE}.`);
    }
    const tmpCwd = fs.mkdtempSync(path.join(os.tmpdir(), "gru-all-runtimes-"));
    try {
      const result = spawnSync(
        process.execPath,
        [CLI_BUNDLE, "init", "--scope", "project", "--runtime", "all"],
        { encoding: "utf8", cwd: tmpCwd, timeout: 20_000 }
      );
      expect(result.status).toBe(0);
      expect(fs.existsSync(path.join(tmpCwd, ".claude", "CLAUDE.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpCwd, ".gemini", "GEMINI.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpCwd, ".cursor", "rules", "gru.mdc"))).toBe(true);
    } finally {
      fs.rmSync(tmpCwd, { recursive: true, force: true });
    }
  });

  test("banner string present in dist/cli.cjs", () => {
    if (!fs.existsSync(CLI_BUNDLE)) {
      throw new Error(`dist/cli.cjs not found at ${CLI_BUNDLE}.`);
    }
    const content = fs.readFileSync(CLI_BUNDLE, "utf-8");
    expect(content).toMatch(/GRU/);
    expect(content).toMatch(/HARNESS/);
  });
});

describe("CLI: --scope validation", () => {
  test("invalid --scope value exits 2 and prints an error", () => {
    // dist/cli.cjs must exist (built by `pnpm build`).
    if (!fs.existsSync(CLI_BUNDLE)) {
      throw new Error(
        `dist/cli.cjs not found at ${CLI_BUNDLE}. Run \`pnpm build\` before tests.`
      );
    }
    const result = spawnSync(process.execPath, [CLI_BUNDLE, "init", "--scope", "bad"], {
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/invalid --scope value/i);
  });

  test("valid --scope project exits 0", { timeout: 15_000 }, () => {
    if (!fs.existsSync(CLI_BUNDLE)) {
      throw new Error(`dist/cli.cjs not found at ${CLI_BUNDLE}.`);
    }
    const tmpCwd = fs.mkdtempSync(path.join(os.tmpdir(), "gru-scope-valid-"));
    try {
      const result = spawnSync(
        process.execPath,
        [CLI_BUNDLE, "init", "--scope", "project"],
        {
          encoding: "utf8",
          cwd: tmpCwd,
          timeout: 15_000,
        }
      );
      expect(result.status).toBe(0);
    } finally {
      fs.rmSync(tmpCwd, { recursive: true, force: true });
    }
  });
});
