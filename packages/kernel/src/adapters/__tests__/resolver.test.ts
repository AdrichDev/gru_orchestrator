import { describe, it, expect } from "vitest";
import { DefaultAgentResolver } from "../resolver.js";
import { DefaultSupervisionPolicy } from "../supervision.js";
import { DefaultProviderRegistry } from "../registry-agentic.js";
import type { ProviderAdapter, ProviderAdapterStatus, TaskAssignment } from "../../../../shared/src/ports/orchestration.js";
import type { AgentCatalog, AgentDescriptor, SddPhase, AgentExecutionMode } from "../../../../shared/src/ports/agent.js";
import type { ExecutionResult } from "../../../../shared/src/ports/results.js";
import type { ProviderId } from "../../../../shared/src/ports/provider.js";

function makeAgent(id: string, overrides: Partial<AgentDescriptor> = {}): AgentDescriptor {
  return {
    id,
    provider: "ruflo",
    sourcePath: "/fake",
    name: id,
    description: "",
    capabilities: [],
    supportedPhases: ["apply", "verify"],
    tools: [],
    skills: [],
    executionMode: "write",
    riskLevel: 2,
    canWrite: true,
    canReview: false,
    canTest: false,
    availability: "available",
    ...overrides,
  };
}

class FakeAgentCatalog implements AgentCatalog {
  readonly provider: ProviderId = "ruflo";
  constructor(private agents: AgentDescriptor[]) {}
  async listAgents(): Promise<AgentDescriptor[]> { return this.agents; }
  async getAgent(id: string): Promise<AgentDescriptor | undefined> { return this.agents.find(a => a.id === id); }
  async findByPhase(phase: SddPhase): Promise<AgentDescriptor[]> {
    return this.agents.filter(a => a.supportedPhases.includes(phase)).slice(0, 50);
  }
  async findByCapability(cap: string): Promise<AgentDescriptor[]> {
    return this.agents.filter(a => a.capabilities.includes(cap)).slice(0, 50);
  }
  async findByMode(mode: AgentExecutionMode): Promise<AgentDescriptor[]> {
    return this.agents.filter(a => a.executionMode === mode).slice(0, 50);
  }
}

class FakeProviderAdapter implements ProviderAdapter {
  readonly id: ProviderId;
  constructor(id: ProviderId, private agents: AgentDescriptor[]) { this.id = id; }
  async checkAvailability(): Promise<ProviderAdapterStatus> { return { status: "available" }; }
  getCatalog(): AgentCatalog { return new FakeAgentCatalog(this.agents); }
  async execute(_: TaskAssignment): Promise<ExecutionResult> {
    throw new Error("not used in resolver tests");
  }
}

describe("DefaultAgentResolver", () => {
  const policy = new DefaultSupervisionPolicy();

  function buildRegistry(agents: AgentDescriptor[]): DefaultProviderRegistry {
    const registry = new DefaultProviderRegistry();
    registry.register(new FakeProviderAdapter("ruflo", agents));
    return registry;
  }

  it("resolves valid assignment: executor, reviewer, tester all different", async () => {
    const agents = [
      makeAgent("agent-coder",     { canWrite: true,  canReview: false, canTest: false, executionMode: "write" }),
      makeAgent("agent-reviewer",  { canWrite: false, canReview: true,  canTest: true,  executionMode: "review" }),
      makeAgent("agent-validator", { canWrite: false, canReview: false, canTest: true,  executionMode: "test" }),
    ];
    const resolver = new DefaultAgentResolver(buildRegistry(agents), policy);
    const assignment = await resolver.resolve({ id: "t1", prompt: "build feature" }, "apply");

    expect(assignment.executor.id).toBe("agent-coder");
    expect(assignment.reviewer.id).not.toBe(assignment.executor.id);
    expect(assignment.reviewer.canReview).toBe(true);
    expect(assignment.tester.canTest).toBe(true);
  });

  it("throws CAPABILITY_UNSUPPORTED when no executor found", async () => {
    const agents = [
      makeAgent("agent-reviewer", { canWrite: false, canReview: true, canTest: true, executionMode: "review" }),
    ];
    const resolver = new DefaultAgentResolver(buildRegistry(agents), policy);
    await expect(resolver.resolve({ id: "t1", prompt: "test" }, "apply")).rejects.toThrow(
      "CAPABILITY_UNSUPPORTED"
    );
  });

  it("throws when no independent reviewer available", async () => {
    // Only one agent that is executor — no separate reviewer
    const agents = [
      makeAgent("agent-coder", { canWrite: true, canReview: false, canTest: false }),
    ];
    const resolver = new DefaultAgentResolver(buildRegistry(agents), policy);
    await expect(resolver.resolve({ id: "t1", prompt: "test" }, "apply")).rejects.toThrow(
      "CAPABILITY_UNSUPPORTED"
    );
  });

  it("throws when requireRufloTester=true but no tester available", async () => {
    const agents = [
      makeAgent("agent-coder",    { canWrite: true,  canReview: false, canTest: false }),
      makeAgent("agent-reviewer", { canWrite: false, canReview: true,  canTest: false, executionMode: "review" }),
    ];
    const resolver = new DefaultAgentResolver(buildRegistry(agents), policy);
    await expect(resolver.resolve({ id: "t1", prompt: "test" }, "apply")).rejects.toThrow(
      "CAPABILITY_UNSUPPORTED"
    );
  });

  it("throws SUPERVISION_VIOLATION if policy detects violation after selection", async () => {
    // Policy with requireRufloReviewer=true but reviewer is awesomeCopilot provider
    const agents = [
      makeAgent("agent-coder",    { canWrite: true,  canReview: false, canTest: false }),
      makeAgent("ac-reviewer",    { provider: "awesomeCopilot", canWrite: false, canReview: true, canTest: true, executionMode: "review" }),
    ];
    const resolver = new DefaultAgentResolver(buildRegistry(agents), policy);
    await expect(resolver.resolve({ id: "t1", prompt: "test" }, "apply")).rejects.toThrow();
  });

  it("throws CAPABILITY_UNSUPPORTED when no providers in registry", async () => {
    const registry = new DefaultProviderRegistry();
    const resolver = new DefaultAgentResolver(registry, policy);
    await expect(resolver.resolve({ id: "t1", prompt: "test" }, "apply")).rejects.toThrow(
      "CAPABILITY_UNSUPPORTED"
    );
  });
});

// ─── Multi-provider scenarios ─────────────────────────────────────────────────

describe("DefaultAgentResolver — multi-provider", () => {
  const policy = new DefaultSupervisionPolicy();

  function acAgent(id: string): AgentDescriptor {
    return makeAgent(id, {
      provider: "awesomeCopilot",
      canWrite: true, canReview: false, canTest: false,
      executionMode: "write",
    });
  }

  function rufloReviewer(id: string): AgentDescriptor {
    return makeAgent(id, {
      provider: "ruflo",
      canWrite: false, canReview: true, canTest: true,
      executionMode: "review",
    });
  }

  function rufloTester(id: string): AgentDescriptor {
    return makeAgent(id, {
      provider: "ruflo",
      canWrite: false, canReview: false, canTest: true,
      executionMode: "test",
    });
  }

  function buildMultiRegistry(
    acAgents: AgentDescriptor[],
    rufloAgents: AgentDescriptor[]
  ): DefaultProviderRegistry {
    const registry = new DefaultProviderRegistry();
    registry.register(new FakeProviderAdapter("awesomeCopilot", acAgents));
    registry.register(new FakeProviderAdapter("ruflo", rufloAgents));
    return registry;
  }

  it("selects AC skill as executor when it matches phase, reviewer+tester from Ruflo", async () => {
    const registry = buildMultiRegistry(
      [acAgent("invocable-skill")],
      [rufloReviewer("agent-reviewer"), rufloTester("agent-validator")]
    );
    const resolver = new DefaultAgentResolver(registry, policy);
    const assignment = await resolver.resolve({ id: "t1", prompt: "audit security" }, "apply");

    expect(assignment.executor.provider).toBe("awesomeCopilot");
    expect(assignment.executor.id).toBe("invocable-skill");
    expect(assignment.reviewer.provider).toBe("ruflo");
    expect(assignment.tester.provider).toBe("ruflo");
  });

  it("selects Ruflo as executor when AC has no invocable skills (all unavailable)", async () => {
    const contextOnlyAc = makeAgent("context-only-skill", {
      provider: "awesomeCopilot",
      availability: "unavailable",
      canWrite: false, canReview: false, canTest: false,
    });
    const rufloExecutor = makeAgent("agent-coder", {
      provider: "ruflo",
      canWrite: true, executionMode: "write",
    });

    const registry = buildMultiRegistry(
      [contextOnlyAc],
      [rufloExecutor, rufloReviewer("agent-reviewer"), rufloTester("agent-validator")]
    );
    const resolver = new DefaultAgentResolver(registry, policy);
    const assignment = await resolver.resolve({ id: "t1", prompt: "build feature" }, "apply");

    expect(assignment.executor.provider).toBe("ruflo");
    expect(assignment.executor.id).toBe("agent-coder");
  });

  it("reviewer is always Ruflo regardless of executor provider", async () => {
    const registry = buildMultiRegistry(
      [acAgent("invocable-skill")],
      [rufloReviewer("agent-reviewer"), rufloTester("agent-validator")]
    );
    const resolver = new DefaultAgentResolver(registry, policy);
    const assignment = await resolver.resolve({ id: "t1", prompt: "test" }, "apply");

    expect(assignment.reviewer.provider).toBe("ruflo");
    expect(assignment.reviewer.canReview).toBe(true);
  });

  it("tester is always Ruflo regardless of executor provider", async () => {
    const registry = buildMultiRegistry(
      [acAgent("invocable-skill")],
      [rufloReviewer("agent-reviewer"), rufloTester("agent-validator")]
    );
    const resolver = new DefaultAgentResolver(registry, policy);
    const assignment = await resolver.resolve({ id: "t1", prompt: "test" }, "apply");

    expect(assignment.tester.provider).toBe("ruflo");
    expect(assignment.tester.canTest).toBe(true);
  });

  it("blocks when AC skill is context-only and no Ruflo executor either", async () => {
    const contextOnlyAc = makeAgent("context-only", {
      provider: "awesomeCopilot",
      availability: "unavailable",
      canWrite: false,
    });
    // Only reviewer/tester in Ruflo, no executor
    const registry = buildMultiRegistry(
      [contextOnlyAc],
      [rufloReviewer("agent-reviewer"), rufloTester("agent-validator")]
    );
    const resolver = new DefaultAgentResolver(registry, policy);
    await expect(resolver.resolve({ id: "t1", prompt: "build" }, "apply")).rejects.toThrow(
      "CAPABILITY_UNSUPPORTED"
    );
  });

  it("executor id !== reviewer id even across providers", async () => {
    const registry = buildMultiRegistry(
      [acAgent("ac-executor")],
      [rufloReviewer("agent-reviewer"), rufloTester("agent-validator")]
    );
    const resolver = new DefaultAgentResolver(registry, policy);
    const assignment = await resolver.resolve({ id: "t1", prompt: "test" }, "apply");

    expect(assignment.executor.id).not.toBe(assignment.reviewer.id);
  });

  it("registry.getAvailable returns only available adapters", async () => {
    const registry = new DefaultProviderRegistry();
    registry.register(new FakeProviderAdapter("awesomeCopilot", [acAgent("ac-skill")]));
    registry.register(new FakeProviderAdapter("ruflo", [rufloReviewer("agent-reviewer")]));

    const available = await registry.getAvailable();
    expect(available).toHaveLength(2);
    expect(available.map((a) => a.id)).toContain("awesomeCopilot");
    expect(available.map((a) => a.id)).toContain("ruflo");
  });
});
