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
  type InstallScope,
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
