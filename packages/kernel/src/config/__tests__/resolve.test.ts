import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

// We test resolveGruRoot() by controlling the environment and filesystem.
// Each branch is exercised with a real temporary directory so we don't need to mock fs.

describe("resolveGruRoot", () => {
  let tmpDir: string;
  let originalCwd: string;
  let originalEnv: typeof process.env;

  beforeEach(() => {
    // Snapshot env and cwd before each test
    originalEnv = { ...process.env };
    originalCwd = process.cwd();

    // Create a fresh temp dir for this test
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gru-resolve-test-"));
  });

  afterEach(() => {
    // Restore env and cwd
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
    process.chdir(originalCwd);

    // Cleanup temp dir
    fs.rmSync(tmpDir, { recursive: true, force: true });

    // Clear module cache so resolveGruRoot() is re-evaluated with fresh env
    vi.resetModules();
  });

  it("branch 1 — GRU_CONFIG_DIR env wins when directory exists", async () => {
    const customDir = path.join(tmpDir, "custom-gru");
    fs.mkdirSync(customDir, { recursive: true });
    process.env.GRU_CONFIG_DIR = customDir;

    // Import after env is set (module may be cached, but resolveGruRoot reads env on call)
    const { resolveGruRoot } = await import("../resolve.js");
    expect(resolveGruRoot()).toBe(customDir);
  });

  it("branch 1 — GRU_CONFIG_DIR is ignored when directory does NOT exist", async () => {
    const missingDir = path.join(tmpDir, "nonexistent");
    process.env.GRU_CONFIG_DIR = missingDir;

    // Set up a project .gru/ so we fall to branch 2 (not branch 3)
    const projectDir = path.join(tmpDir, "project");
    const gruDir = path.join(projectDir, ".gru");
    fs.mkdirSync(gruDir, { recursive: true });
    process.chdir(projectDir);

    const { resolveGruRoot } = await import("../resolve.js");
    expect(resolveGruRoot()).toBe(gruDir);
  });

  it("branch 2 — project .gru/ found in cwd wins over home", async () => {
    delete process.env.GRU_CONFIG_DIR;

    const projectDir = path.join(tmpDir, "project");
    const gruDir = path.join(projectDir, ".gru");
    fs.mkdirSync(gruDir, { recursive: true });
    process.chdir(projectDir);

    const { resolveGruRoot } = await import("../resolve.js");
    expect(resolveGruRoot()).toBe(gruDir);
  });

  it("branch 2 — project .gru/ found by walking up from a subdirectory", async () => {
    delete process.env.GRU_CONFIG_DIR;

    const projectDir = path.join(tmpDir, "project");
    const gruDir = path.join(projectDir, ".gru");
    const deepDir = path.join(projectDir, "src", "deep", "nested");
    fs.mkdirSync(gruDir, { recursive: true });
    fs.mkdirSync(deepDir, { recursive: true });
    process.chdir(deepDir);

    const { resolveGruRoot } = await import("../resolve.js");
    expect(resolveGruRoot()).toBe(gruDir);
  });

  it("branch 3 — falls back to ~/.gru when no env and no project .gru/", async () => {
    delete process.env.GRU_CONFIG_DIR;

    // chdir to tmpDir which has NO .gru/ and is NOT under home
    process.chdir(tmpDir);

    const { resolveGruRoot } = await import("../resolve.js");
    const expected = path.join(os.homedir(), ".gru");
    expect(resolveGruRoot()).toBe(expected);
  });

  it("resolveConfigPath — returns config.yaml under gru root", async () => {
    delete process.env.GRU_CONFIG_DIR;

    const projectDir = path.join(tmpDir, "project");
    const gruDir = path.join(projectDir, ".gru");
    fs.mkdirSync(gruDir, { recursive: true });
    process.chdir(projectDir);

    const { resolveConfigPath } = await import("../resolve.js");
    expect(resolveConfigPath()).toBe(path.join(gruDir, "config.yaml"));
  });

  it("resolveProvidersPath — returns providers.yaml under gru root", async () => {
    delete process.env.GRU_CONFIG_DIR;

    const projectDir = path.join(tmpDir, "project");
    const gruDir = path.join(projectDir, ".gru");
    fs.mkdirSync(gruDir, { recursive: true });
    process.chdir(projectDir);

    const { resolveProvidersPath } = await import("../resolve.js");
    expect(resolveProvidersPath()).toBe(path.join(gruDir, "providers.yaml"));
  });

  it("resolveRunsDir — GRU_RUNS_DIR env wins", async () => {
    const customRuns = path.join(tmpDir, "my-runs");
    process.env.GRU_RUNS_DIR = customRuns;

    const { resolveRunsDir } = await import("../resolve.js");
    expect(resolveRunsDir()).toBe(customRuns);
  });

  it("resolveRunsDir — falls back to <gru-root>/runs", async () => {
    delete process.env.GRU_CONFIG_DIR;
    delete process.env.GRU_RUNS_DIR;

    const projectDir = path.join(tmpDir, "project");
    const gruDir = path.join(projectDir, ".gru");
    fs.mkdirSync(gruDir, { recursive: true });
    process.chdir(projectDir);

    const { resolveRunsDir } = await import("../resolve.js");
    expect(resolveRunsDir()).toBe(path.join(gruDir, "runs"));
  });

  it("resolveAwesomeCopilotPath — GRU_AWESOME_COPILOT_PATH env wins", async () => {
    const acPath = path.join(tmpDir, "my-awesome-copilot");
    process.env.GRU_AWESOME_COPILOT_PATH = acPath;

    const { resolveAwesomeCopilotPath } = await import("../resolve.js");
    expect(resolveAwesomeCopilotPath()).toBe(acPath);
  });

  it("resolveAwesomeCopilotPath — falls back to <gru-root>/awesome-copilot when it exists", async () => {
    delete process.env.GRU_CONFIG_DIR;
    delete process.env.GRU_AWESOME_COPILOT_PATH;

    const projectDir = path.join(tmpDir, "project");
    const gruDir = path.join(projectDir, ".gru");
    const gruAcPath = path.join(gruDir, "awesome-copilot");
    fs.mkdirSync(gruAcPath, { recursive: true }); // create the ac dir so it exists
    process.chdir(projectDir);

    const { resolveAwesomeCopilotPath } = await import("../resolve.js");
    expect(resolveAwesomeCopilotPath()).toBe(gruAcPath);
  });

  it("resolveAwesomeCopilotPath — returns .gru path (install hint) when no candidate exists", async () => {
    delete process.env.GRU_CONFIG_DIR;
    delete process.env.GRU_AWESOME_COPILOT_PATH;

    const projectDir = path.join(tmpDir, "project");
    const gruDir = path.join(projectDir, ".gru");
    fs.mkdirSync(gruDir, { recursive: true }); // .gru exists but awesome-copilot subdir does NOT
    process.chdir(projectDir);

    const { resolveAwesomeCopilotPath } = await import("../resolve.js");
    // None exist → returns .gru/awesome-copilot as the "install hint" path
    expect(resolveAwesomeCopilotPath()).toBe(path.join(gruDir, "awesome-copilot"));
  });

  it("resolveAwesomeCopilotPath — vendor/awesome-copilot fallback (priority 3)", async () => {
    delete process.env.GRU_CONFIG_DIR;
    delete process.env.GRU_AWESOME_COPILOT_PATH;

    const projectDir = path.join(tmpDir, "project");
    const gruDir = path.join(projectDir, ".gru");
    // .gru/awesome-copilot does NOT exist
    fs.mkdirSync(gruDir, { recursive: true });

    // vendor/awesome-copilot DOES exist
    const vendorAcPath = path.join(projectDir, "vendor", "awesome-copilot");
    fs.mkdirSync(vendorAcPath, { recursive: true });

    process.chdir(projectDir);

    const { resolveAwesomeCopilotPath } = await import("../resolve.js");
    expect(resolveAwesomeCopilotPath()).toBe(vendorAcPath);
  });

  it("resolveAwesomeCopilotPath — vendor fallback found by walking up from subdirectory", async () => {
    delete process.env.GRU_CONFIG_DIR;
    delete process.env.GRU_AWESOME_COPILOT_PATH;

    const projectDir = path.join(tmpDir, "project");
    const gruDir = path.join(projectDir, ".gru");
    fs.mkdirSync(gruDir, { recursive: true });

    const vendorAcPath = path.join(projectDir, "vendor", "awesome-copilot");
    fs.mkdirSync(vendorAcPath, { recursive: true });

    // chdir into a deep subdir
    const deepDir = path.join(projectDir, "packages", "kernel", "src");
    fs.mkdirSync(deepDir, { recursive: true });
    process.chdir(deepDir);

    const { resolveAwesomeCopilotPath } = await import("../resolve.js");
    expect(resolveAwesomeCopilotPath()).toBe(vendorAcPath);
  });

  it("resolveAwesomeCopilotPath — .gru/awesome-copilot wins over vendor when both exist", async () => {
    delete process.env.GRU_CONFIG_DIR;
    delete process.env.GRU_AWESOME_COPILOT_PATH;

    const projectDir = path.join(tmpDir, "project");
    const gruDir = path.join(projectDir, ".gru");
    const gruAcPath = path.join(gruDir, "awesome-copilot");
    fs.mkdirSync(gruAcPath, { recursive: true }); // priority 2 exists

    const vendorAcPath = path.join(projectDir, "vendor", "awesome-copilot");
    fs.mkdirSync(vendorAcPath, { recursive: true }); // priority 3 also exists

    process.chdir(projectDir);

    const { resolveAwesomeCopilotPath } = await import("../resolve.js");
    // .gru/awesome-copilot (priority 2) should win
    expect(resolveAwesomeCopilotPath()).toBe(gruAcPath);
  });
});
