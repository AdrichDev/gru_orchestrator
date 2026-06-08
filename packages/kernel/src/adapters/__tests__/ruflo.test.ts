import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import { RufloAgentCatalog, RufloProviderAdapter } from "../ruflo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures");

// Simulate .agents/skills structure under fixtures dir
const MOCK_BASE = path.join(__dirname, "mock-ruflo");

import fs from "fs";

function setupMockRuflo() {
  const skillsDir = path.join(MOCK_BASE, ".agents", "skills");
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
    // Copy fixtures into mock structure
    for (const name of ["agent-coder", "agent-reviewer", "agent-production-validator", "context-skill-only"]) {
      const src = path.join(FIXTURES, name, "SKILL.md");
      const dest = path.join(skillsDir, name);
      fs.mkdirSync(dest, { recursive: true });
      fs.copyFileSync(src, path.join(dest, "SKILL.md"));
    }
  }
  return MOCK_BASE;
}

describe("RufloAgentCatalog", () => {
  let catalog: RufloAgentCatalog;
  let basePath: string;

  beforeAll(() => {
    basePath = setupMockRuflo();
    catalog = new RufloAgentCatalog(basePath);
  });

  it("listAgents returns agent-* entries only", async () => {
    const agents = await catalog.listAgents();
    const ids = agents.map((a) => a.id);
    expect(ids).toContain("agent-coder");
    expect(ids).toContain("agent-reviewer");
    // context-skill-only does not start with agent-
    expect(ids).not.toContain("context-skill-only");
  });

  it("agent-coder has canWrite=true, correct executionMode", async () => {
    const agent = await catalog.getAgent("agent-coder");
    expect(agent).toBeDefined();
    expect(agent!.canWrite).toBe(true);
    expect(agent!.canReview).toBe(false);
    expect(agent!.executionMode).toBe("write");
    expect(agent!.supportedPhases).toContain("apply");
    expect(agent!.availability).toBe("available");
  });

  it("agent-reviewer has canReview=true, canTest=true (validator type)", async () => {
    const agent = await catalog.getAgent("agent-reviewer");
    expect(agent).toBeDefined();
    expect(agent!.canWrite).toBe(false);
    expect(agent!.canReview).toBe(true);
    expect(agent!.canTest).toBe(true);
    expect(agent!.executionMode).toBe("review");
  });

  it("agent-production-validator has canTest=true (validator type)", async () => {
    const agent = await catalog.getAgent("agent-production-validator");
    expect(agent).toBeDefined();
    expect(agent!.canTest).toBe(true);
    expect(agent!.riskLevel).toBe(4); // critical priority
  });

  it("findByPhase('apply') returns only write-capable agents", async () => {
    const result = await catalog.findByPhase("apply");
    expect(result.every((a) => a.supportedPhases.includes("apply"))).toBe(true);
  });

  it("findByMode('review') returns only review-mode agents", async () => {
    const result = await catalog.findByMode("review");
    expect(result.every((a) => a.executionMode === "review")).toBe(true);
  });

  it("capabilities parsed correctly", async () => {
    const agent = await catalog.getAgent("agent-coder");
    expect(agent!.capabilities).toContain("code_generation");
    expect(agent!.capabilities).toContain("refactoring");
  });

  it("missing .agents/skills dir → empty list, no throw", async () => {
    const emptyCatalog = new RufloAgentCatalog("/nonexistent/path");
    const agents = await emptyCatalog.listAgents();
    expect(agents).toEqual([]);
  });
});

describe("RufloProviderAdapter", () => {
  it("checkAvailability returns unavailable when path missing", async () => {
    const adapter = new RufloProviderAdapter("/nonexistent");
    const status = await adapter.checkAvailability();
    expect(status.status).toBe("unavailable");
  });

  it("checkAvailability returns available when path exists", async () => {
    const basePath = setupMockRuflo();
    const adapter = new RufloProviderAdapter(basePath);
    const status = await adapter.checkAvailability();
    expect(status.status).toBe("available");
    expect((status.agentCount ?? 0)).toBeGreaterThan(0);
  });

  it("getCatalog returns an AgentCatalog", () => {
    const adapter = new RufloProviderAdapter("/some/path");
    const catalog = adapter.getCatalog();
    expect(catalog).toBeDefined();
    expect(typeof catalog.listAgents).toBe("function");
  });
});
