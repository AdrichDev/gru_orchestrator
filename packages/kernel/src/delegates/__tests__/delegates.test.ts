import { describe, it, expect, vi } from "vitest";
import type {
  GruProvider,
  ProviderAvailability,
  ProviderResult,
  ProviderTask,
} from "../../../../shared/src/ports/provider.js";
import type {
  ProviderAdapter,
  ProviderAdapterStatus,
  TaskAssignment,
} from "../../../../shared/src/ports/orchestration.js";
import type { ExecutionResult } from "../../../../shared/src/ports/results.js";
import type { AgentCatalog } from "../../../../shared/src/ports/agent.js";
import type { ProviderExecutionRequest } from "../../../../shared/src/ports/delegation.js";
import {
  SimpleProviderDelegate,
  AgenticProviderDelegate,
  ABSOLUTE_PATH,
} from "../base.js";
import { Context7Delegate } from "../context7.js";
import { DefaultDelegationRegistry } from "../registry.js";
import { flagsFor, capabilitiesFor, allowlistFor } from "../capabilities.js";

// ── Test doubles ────────────────────────────────────────────────────────────

function fakeSimpleProvider(opts: {
  available: boolean;
  success?: boolean;
  output?: string;
  error?: string;
  runSpy?: ReturnType<typeof vi.fn>;
}): GruProvider {
  return {
    id: "ecc",
    canHandle: () => true,
    async checkAvailability(): Promise<ProviderAvailability> {
      return { providerId: "ecc", available: opts.available, reason: opts.available ? undefined : "not installed" };
    },
    run:
      (opts.runSpy as GruProvider["run"]) ??
      (async (_task: ProviderTask): Promise<ProviderResult> => ({
        providerId: "ecc",
        success: opts.success ?? true,
        output: opts.output ?? "ok",
        error: opts.error,
      })),
  };
}

function req(operation: string, extra: Partial<ProviderExecutionRequest> = {}): ProviderExecutionRequest {
  return {
    taskId: "task-001",
    prompt: "do the thing",
    operation,
    contextRefs: [],
    artifactRefs: [],
    constraints: [],
    ...extra,
  };
}

/** Fake agentic adapter returning a controllable ExecutionResult / workflow state. */
function fakeAdapter(opts: {
  status?: ProviderAdapterStatus;
  result?: Partial<ExecutionResult>;
  executeSpy?: ReturnType<typeof vi.fn>;
}): ProviderAdapter {
  const baseResult = (assignment: TaskAssignment): ExecutionResult => ({
    assignmentId: assignment.id,
    agent: assignment.executor,
    phase: assignment.phase,
    success: false,
    output: "",
    affectedFiles: [],
    artifacts: [],
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    ...opts.result,
  });
  return {
    id: "ruflo",
    async checkAvailability(): Promise<ProviderAdapterStatus> {
      return opts.status ?? { status: "available" };
    },
    getCatalog(): AgentCatalog {
      return {} as AgentCatalog;
    },
    execute: (opts.executeSpy as ProviderAdapter["execute"]) ?? (async (a: TaskAssignment) => baseResult(a)),
  };
}

// ── Operation validation ──────────────────────────────────────────────────────

describe("operation validation (allowlist before runtime)", () => {
  it("awesomeCopilot + implement → UNSUPPORTED without calling run()", async () => {
    const runSpy = vi.fn();
    const provider = fakeSimpleProvider({ available: true, runSpy });
    const delegate = new SimpleProviderDelegate("awesomeCopilot", provider);

    const res = await delegate.execute(req("implement"));

    expect(res.status).toBe("UNSUPPORTED");
    expect(runSpy).not.toHaveBeenCalled();
  });

  it("engram + implement → UNSUPPORTED without calling run()", async () => {
    const runSpy = vi.fn();
    const provider = fakeSimpleProvider({ available: true, runSpy });
    const delegate = new SimpleProviderDelegate("engram", provider);

    const res = await delegate.execute(req("implement"));

    expect(res.status).toBe("UNSUPPORTED");
    expect(runSpy).not.toHaveBeenCalled();
  });

  it("local + unregistered operation → UNSUPPORTED (empty allowlist)", async () => {
    const runSpy = vi.fn();
    const provider = fakeSimpleProvider({ available: true, runSpy });
    const delegate = new SimpleProviderDelegate("local", provider);

    const res = await delegate.execute(req("anything"));

    expect(res.status).toBe("UNSUPPORTED");
    expect(runSpy).not.toHaveBeenCalled();
  });

  it("ecc + consult (allowed) → calls run() and COMPLETED", async () => {
    const runSpy = vi.fn(async () => ({ providerId: "ecc", success: true, output: "advice" }));
    const provider = fakeSimpleProvider({ available: true, runSpy });
    const delegate = new SimpleProviderDelegate("ecc", provider);

    const res = await delegate.execute(req("consult"));

    expect(res.status).toBe("COMPLETED");
    expect(runSpy).toHaveBeenCalledOnce();
  });
});

// ── wrapSyncRun status mapping ────────────────────────────────────────────────

describe("synchronous status mapping", () => {
  it("success → COMPLETED", async () => {
    const delegate = new SimpleProviderDelegate("ecc", fakeSimpleProvider({ available: true, success: true, output: "x" }));
    expect((await delegate.execute(req("consult"))).status).toBe("COMPLETED");
  });

  it("failure → FAILED (not COMPLETED)", async () => {
    const delegate = new SimpleProviderDelegate("ecc", fakeSimpleProvider({ available: true, success: false, error: "boom" }));
    const res = await delegate.execute(req("consult"));
    expect(res.status).toBe("FAILED");
    expect(res.error).toBe("boom");
  });

  it("unavailable → UNAVAILABLE without calling run()", async () => {
    const runSpy = vi.fn();
    const provider = fakeSimpleProvider({ available: false, runSpy });
    const delegate = new SimpleProviderDelegate("ecc", provider);

    const res = await delegate.execute(req("consult"));

    expect(res.status).toBe("UNAVAILABLE");
    expect(runSpy).not.toHaveBeenCalled();
  });
});

// ── Agentic (Ruflo workflow) honest status ────────────────────────────────────

describe("agentic delegate honest status", () => {
  it("SUBMITTED workflow state ↛ COMPLETED; preserves externalExecutionId", async () => {
    const adapter = fakeAdapter({
      result: { success: false, output: "[SUBMITTED] ...", artifacts: ["ruflo:workflow:wf-123:submitted"] },
    });
    const delegate = new AgenticProviderDelegate("ruflo", adapter);

    const res = await delegate.execute(req("implement"));

    expect(res.status).toBe("SUBMITTED");
    expect(res.status).not.toBe("COMPLETED");
    expect(res.externalExecutionId).toBe("wf-123");
  });

  it("RUNNING workflow state ↛ COMPLETED", async () => {
    const adapter = fakeAdapter({
      result: { success: false, artifacts: ["ruflo:workflow:wf-9:running"] },
    });
    const delegate = new AgenticProviderDelegate("ruflo", adapter);
    expect((await delegate.execute(req("implement"))).status).toBe("RUNNING");
  });

  it("stuck workflow (unknown) → UNSUPPORTED, never COMPLETED", async () => {
    const adapter = fakeAdapter({
      result: { success: false, artifacts: ["ruflo:workflow:wf-7:unknown"] },
    });
    const delegate = new AgenticProviderDelegate("ruflo", adapter);
    const res = await delegate.execute(req("implement"));
    expect(res.status).toBe("UNSUPPORTED");
    expect(res.status).not.toBe("COMPLETED");
  });

  it("timeout → TIMEOUT, not generic FAILED", async () => {
    const adapter = fakeAdapter({
      result: { success: false, artifacts: ["ruflo:workflow:wf-5:timeout"] },
    });
    const delegate = new AgenticProviderDelegate("ruflo", adapter);
    const res = await delegate.execute(req("implement"));
    expect(res.status).toBe("TIMEOUT");
    expect(res.status).not.toBe("FAILED");
  });

  it("completed terminal state → COMPLETED", async () => {
    const adapter = fakeAdapter({
      result: { success: true, output: "real result", artifacts: ["ruflo:workflow:wf-1:completed"] },
    });
    const delegate = new AgenticProviderDelegate("ruflo", adapter);
    expect((await delegate.execute(req("implement"))).status).toBe("COMPLETED");
  });

  it("unsupported operation → UNSUPPORTED without calling adapter.execute()", async () => {
    const executeSpy = vi.fn();
    const adapter = fakeAdapter({ executeSpy });
    const delegate = new AgenticProviderDelegate("ruflo", adapter);

    const res = await delegate.execute(req("memory.store"));

    expect(res.status).toBe("UNSUPPORTED");
    expect(executeSpy).not.toHaveBeenCalled();
  });
});

// ── Context7 (PLANNED / always UNAVAILABLE) ───────────────────────────────────

describe("Context7 delegate", () => {
  it("detect() → UNAVAILABLE + PLANNED (no MCP env)", async () => {
    delete process.env.GRU_CONTEXT7_MCP;
    const d = await new Context7Delegate().detect();
    expect(d.status).toBe("UNAVAILABLE");
    expect(d.integration).toBe("PLANNED");
  });

  it("detect() stays UNAVAILABLE even if GRU_CONTEXT7_MCP is set", async () => {
    process.env.GRU_CONTEXT7_MCP = "https://example.invalid/mcp";
    try {
      const d = await new Context7Delegate().detect();
      expect(d.status).toBe("UNAVAILABLE");
      expect(d.integration).toBe("PLANNED");
    } finally {
      delete process.env.GRU_CONTEXT7_MCP;
    }
  });

  it("documentation.fetch (allowed op, no MCP) → UNAVAILABLE, no fabricated docs", async () => {
    const res = await new Context7Delegate().execute(req("documentation.fetch"));
    expect(res.status).toBe("UNAVAILABLE");
    expect(res.output).toBeUndefined();
  });

  it("unknown op → UNSUPPORTED", async () => {
    const res = await new Context7Delegate().execute(req("implement"));
    expect(res.status).toBe("UNSUPPORTED");
  });
});

// ── Registry (no silent fallback, no duplicates) ──────────────────────────────

describe("delegation registry", () => {
  it("UNAVAILABLE delegates (context7, engram) are excluded from getAvailable()", async () => {
    const registry = new DefaultDelegationRegistry();
    registry.register({ id: "context7", delegate: new Context7Delegate(), capabilities: flagsFor("context7") });
    registry.register({
      id: "engram",
      delegate: new SimpleProviderDelegate("engram", fakeSimpleProvider({ available: false })),
      capabilities: flagsFor("engram"),
    });
    registry.register({
      id: "ecc",
      delegate: new SimpleProviderDelegate("ecc", fakeSimpleProvider({ available: true })),
      capabilities: flagsFor("ecc"),
    });

    const available = await registry.getAvailable();
    const ids = available.map((r) => r.id);

    expect(ids).toContain("ecc");
    expect(ids).not.toContain("context7");
    expect(ids).not.toContain("engram");
  });

  it("duplicate registration is rejected", () => {
    const registry = new DefaultDelegationRegistry();
    const reg = { id: "ecc" as const, delegate: new SimpleProviderDelegate("ecc", fakeSimpleProvider({ available: true })), capabilities: flagsFor("ecc") };
    registry.register(reg);
    expect(() => registry.register(reg)).toThrow(/already registered/);
  });
});

// ── Capabilities (no fake capabilities) ───────────────────────────────────────

describe("capability declarations", () => {
  it("flagsFor matches declared capability names", () => {
    expect(flagsFor("awesomeCopilot").skillDiscovery).toBe(true);
    expect(flagsFor("awesomeCopilot").implementation).toBe(false);
    expect(flagsFor("engram").memory).toBe(true);
    expect(flagsFor("context7").documentation).toBe(true);
    expect(flagsFor("local")).toMatchObject({ implementation: false, memory: false });
  });

  it("allowlist is the union of capability operations", () => {
    expect(allowlistFor("awesomeCopilot")).toEqual(
      expect.arrayContaining(["skill.discover", "skill.search", "skill.read", "catalog.search"]),
    );
    expect(allowlistFor("awesomeCopilot")).not.toContain("implement");
    expect(allowlistFor("local")).toHaveLength(0);
  });

  it("ruflo capabilities are async (synchronous=false)", () => {
    expect(capabilitiesFor("ruflo").every((c) => c.synchronous === false)).toBe(true);
  });
});

// ── Portable references ───────────────────────────────────────────────────────

describe("portable references", () => {
  it("ABSOLUTE_PATH detects machine paths", () => {
    expect(ABSOLUTE_PATH.test("D:\\Adrian\\x")).toBe(true);
    expect(ABSOLUTE_PATH.test("/home/x")).toBe(true);
    expect(ABSOLUTE_PATH.test("awesome-copilot:skill:x")).toBe(false);
    expect(ABSOLUTE_PATH.test("vendor/awesome-copilot/skills/x/SKILL.md")).toBe(false);
  });

  it("agentic delegate strips absolute artifacts and keeps logical refs", async () => {
    const adapter = fakeAdapter({
      result: {
        success: true,
        artifacts: ["ruflo:workflow:wf-1:completed", "D:\\Adrian\\should-be-dropped"],
      },
    });
    const delegate = new AgenticProviderDelegate("ruflo", adapter);
    const res = await delegate.execute(req("implement"));

    expect(res.artifacts).toContain("ruflo:workflow:wf-1:completed");
    expect(res.artifacts?.some((a) => ABSOLUTE_PATH.test(a))).toBe(false);
  });
});
