import { describe, it, expect } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import { AwesomeCopilotAgentCatalog, AwesomeCopilotProviderAdapter } from "../awesome-copilot.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_AC = path.join(__dirname, "fixtures-ac");

// Build mock root where skills/ subfolder = fixtures-ac
const MOCK_AC_ROOT = path.join(__dirname, "mock-ac-root");

import fs from "fs";

function setupMockAcRoot() {
  const skillsDir = path.join(MOCK_AC_ROOT, "skills");
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
    for (const name of ["invocable-skill", "context-only-skill"]) {
      const src = path.join(FIXTURES_AC, name, "SKILL.md");
      const dest = path.join(skillsDir, name);
      fs.mkdirSync(dest, { recursive: true });
      fs.copyFileSync(src, path.join(dest, "SKILL.md"));
    }
  }
  return MOCK_AC_ROOT;
}

describe("AwesomeCopilotAgentCatalog", () => {
  it("invocable skill (argument-hint) → available, canWrite=true", async () => {
    const root = setupMockAcRoot();
    const catalog = new AwesomeCopilotAgentCatalog(root);
    const agent = await catalog.getAgent("invocable-skill");

    expect(agent).toBeDefined();
    expect(agent!.availability).toBe("available");
    expect(agent!.canWrite).toBe(true);
    expect(agent!.canReview).toBe(false);
    expect(agent!.canTest).toBe(false);
    expect(agent!.executionMode).toBe("write");
    expect(agent!.supportedPhases).toContain("apply");
  });

  it("context-only skill (no argument-hint) → unavailable", async () => {
    const root = setupMockAcRoot();
    const catalog = new AwesomeCopilotAgentCatalog(root);
    const agent = await catalog.getAgent("context-only-skill");

    expect(agent).toBeDefined();
    expect(agent!.availability).toBe("unavailable");
    expect(agent!.canWrite).toBe(false);
    expect(agent!.canReview).toBe(false);
    expect(agent!.canTest).toBe(false);
  });

  it("findByPhase('apply') returns only invocable skills", async () => {
    const root = setupMockAcRoot();
    const catalog = new AwesomeCopilotAgentCatalog(root);
    const results = await catalog.findByPhase("apply");

    expect(results.every((a) => a.availability === "available")).toBe(true);
    expect(results.some((a) => a.id === "invocable-skill")).toBe(true);
    expect(results.some((a) => a.id === "context-only-skill")).toBe(false);
  });

  it("findByMode('write') returns only invocable skills", async () => {
    const root = setupMockAcRoot();
    const catalog = new AwesomeCopilotAgentCatalog(root);
    const results = await catalog.findByMode("write");

    expect(results.every((a) => a.executionMode === "write")).toBe(true);
    expect(results.some((a) => a.id === "context-only-skill")).toBe(false);
  });

  it("listAgents includes both invocable and context-only", async () => {
    const root = setupMockAcRoot();
    const catalog = new AwesomeCopilotAgentCatalog(root);
    const all = await catalog.listAgents();
    const ids = all.map((a) => a.id);

    expect(ids).toContain("invocable-skill");
    expect(ids).toContain("context-only-skill");
    expect(all).toHaveLength(2);
  });

  it("missing root → empty list, no throw", async () => {
    const catalog = new AwesomeCopilotAgentCatalog("/nonexistent/path");
    const agents = await catalog.listAgents();
    expect(agents).toEqual([]);
  });

  it("capabilities derived from security description", async () => {
    const root = setupMockAcRoot();
    const catalog = new AwesomeCopilotAgentCatalog(root);
    const agent = await catalog.getAgent("invocable-skill");
    expect(agent!.capabilities).toContain("security_analysis");
  });
});

describe("AwesomeCopilotProviderAdapter", () => {
  it("checkAvailability → unavailable when path missing", async () => {
    const adapter = new AwesomeCopilotProviderAdapter("/nonexistent");
    const status = await adapter.checkAvailability();
    expect(status.status).toBe("unavailable");
  });

  it("checkAvailability → available when root exists with invocable skills", async () => {
    const root = setupMockAcRoot();
    const adapter = new AwesomeCopilotProviderAdapter(root);
    const status = await adapter.checkAvailability();
    expect(status.status).toBe("available");
    expect((status.agentCount ?? 0)).toBeGreaterThan(0);
  });

  it("getCatalog returns the AwesomeCopilotAgentCatalog", () => {
    const adapter = new AwesomeCopilotProviderAdapter("/some/path");
    const catalog = adapter.getCatalog();
    expect(catalog).toBeDefined();
    expect(catalog.provider).toBe("awesomeCopilot");
    expect(typeof catalog.listAgents).toBe("function");
  });
});
