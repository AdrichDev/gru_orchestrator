import { describe, it, expect, vi, beforeAll } from "vitest";
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
import { resolveDelegate } from "../resolver.js";

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
    id: "local",
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



// ── Context7 (real MCP probe with injected deps) ─────────────────────────────

describe("Context7 delegate", () => {
  const mockConfig = { command: "npx", args: ["-y", "--package=@upstash/context7-mcp", "--", "context7-mcp"] };

  it("detect() without config → UNAVAILABLE + PLANNED", async () => {
    const d = new Context7Delegate(() => null, async () => false);
    const detection = await d.detect();
    expect(detection.status).toBe("UNAVAILABLE");
    expect(detection.integration).toBe("PLANNED");
    expect(detection.installHint).toBeTruthy();
  });

  it("detect() with config but probe fails → UNAVAILABLE + READY", async () => {
    const d = new Context7Delegate(() => mockConfig, async () => false);
    const detection = await d.detect();
    expect(detection.status).toBe("UNAVAILABLE");
    expect(detection.integration).toBe("READY");
    expect(detection.reason).toMatch(/did not respond/);
  });

  it("detect() with config and probe succeeds → AVAILABLE + READY", async () => {
    const d = new Context7Delegate(() => mockConfig, async () => true);
    const detection = await d.detect();
    expect(detection.status).toBe("AVAILABLE");
    expect(detection.integration).toBe("READY");
  });

  it("documentation.fetch (allowed op) when UNAVAILABLE → no fabricated docs", async () => {
    const d = new Context7Delegate(() => null, async () => false);
    const res = await d.execute(req("documentation.fetch"));
    expect(res.status).toBe("UNAVAILABLE");
    expect(res.output).toBeUndefined();
  });

  it("documentation.fetch when AVAILABLE → UNAVAILABLE (tool calling not wired), no fabricated docs", async () => {
    const d = new Context7Delegate(() => mockConfig, async () => true);
    const res = await d.execute(req("documentation.fetch"));
    // Server is reachable but tool calling is not implemented yet.
    // Key constraint: no fabricated documentation in output.
    expect(res.output).toBeUndefined();
    expect(res.status).toBe("UNAVAILABLE");
  });

  it("unknown op → UNSUPPORTED without calling probe", async () => {
    const probeSpy = vi.fn(async () => false);
    const d = new Context7Delegate(() => mockConfig, probeSpy);
    const res = await d.execute(req("implement"));
    expect(res.status).toBe("UNSUPPORTED");
    expect(probeSpy).not.toHaveBeenCalled();
  });
});

// ── Registry (no silent fallback, no duplicates) ──────────────────────────────

describe("delegation registry", () => {
  it("UNAVAILABLE delegates (context7, engram) are excluded from getAvailable()", async () => {
    const registry = new DefaultDelegationRegistry();
    // Use injected probe that always fails → UNAVAILABLE
    registry.register({ id: "context7", delegate: new Context7Delegate(() => null, async () => false), capabilities: flagsFor("context7") });
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
});

describe("portable references", () => {
  it("ABSOLUTE_PATH detects machine paths", () => {
    expect(ABSOLUTE_PATH.test("D:\\Adrian\\x")).toBe(true);
    expect(ABSOLUTE_PATH.test("/home/x")).toBe(true);
    expect(ABSOLUTE_PATH.test("awesome-copilot:skill:x")).toBe(false);
    expect(ABSOLUTE_PATH.test("vendor/awesome-copilot/skills/x/SKILL.md")).toBe(false);
  });
});

// ── resolveDelegate (R4) ──────────────────────────────────────────────────────

describe("resolveDelegate", () => {
  function buildRegistry(eccAvailable: boolean): DefaultDelegationRegistry {
    const registry = new DefaultDelegationRegistry();
    registry.register({
      id: "ecc",
      delegate: new SimpleProviderDelegate("ecc", fakeSimpleProvider({ available: eccAvailable })),
      capabilities: flagsFor("ecc"),
    });
    registry.register({
      id: "context7",
      delegate: new Context7Delegate(() => null, async () => false),
      capabilities: flagsFor("context7"),
    });
    return registry;
  }

  it("operation supported by available delegate → blocked: false", async () => {
    const registry = buildRegistry(true);
    const result = await resolveDelegate("consult", registry);
    expect(result.blocked).toBe(false);
    if (!result.blocked) {
      expect(result.delegateId).toBe("ecc");
    }
  });

  it("operation not supported by any delegate → blocked: true with reason", async () => {
    const registry = buildRegistry(true);
    const result = await resolveDelegate("unsupported.xyz.operation", registry);
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("unsupported.xyz.operation");
      expect(result.installHint).toBeTruthy();
    }
  });

  it("delegate available but does not support op → skipped, BLOCKED", async () => {
    const registry = buildRegistry(true);
    // ecc supports "consult" and "review" but not "implement"
    const result = await resolveDelegate("implement", registry);
    // no delegate in this test registry supports "implement" → BLOCKED
    expect(result.blocked).toBe(true);
  });

  it("all delegates UNAVAILABLE → blocked: true", async () => {
    const registry = buildRegistry(false);
    const result = await resolveDelegate("consult", registry);
    // ecc unavailable → excluded from getAvailable() → BLOCKED
    expect(result.blocked).toBe(true);
  });

  it("does not silently fall back to a different operation", async () => {
    const registry = buildRegistry(true);
    const result = await resolveDelegate("memory.store", registry);
    // ecc does not support memory.store → BLOCKED (no silent remap)
    expect(result.blocked).toBe(true);
  });
});
