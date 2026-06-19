import { describe, it, expect, vi } from "vitest";
import type {
  ProviderDetection,
  ProviderCapability,
  ProviderExecutionRequest,
  ProviderExecutionResult,
  ProviderDelegate,
} from "../../../../shared/src/ports/delegation.js";
import { DefaultDelegationRegistry } from "../registry.js";
import { flagsFor } from "../capabilities.js";
import {
  DelegationOrchestrator,
  toPortableRef,
  portableRequest,
  portableResult,
  createOrchestratorFromRegistry,
} from "../orchestrator.js";

// ── Test doubles ──────────────────────────────────────────────────────────────

function fakeDetection(available: boolean, reason?: string): ProviderDetection {
  return {
    providerId: "ecc",
    status: available ? "AVAILABLE" : "UNAVAILABLE",
    integration: "READY",
    reason: available ? undefined : reason ?? "not installed",
  };
}

function fakeDelegate(opts: {
  id: "ecc" | "ruflo" | "engram" | "local" | "context7" | "awesomeCopilot" | "gentlePi" | "gentlemanCli" | "deepagents";
  available?: boolean;
  operations?: string[];
  result?: Partial<ProviderExecutionResult>;
  executeSpy?: ReturnType<typeof vi.fn>;
}): ProviderDelegate {
  const available = opts.available ?? true;
  const operations = opts.operations ?? ["consult", "review"];
  const executeSpy =
    opts.executeSpy ??
    vi.fn(async (_req: ProviderExecutionRequest): Promise<ProviderExecutionResult> => ({
      providerId: opts.id,
      invocationId: `inv-test-${opts.id}`,
      status: "COMPLETED",
      output: "ok",
      artifacts: [],
      ...opts.result,
    }));

  return {
    id: opts.id,
    detect: vi.fn(async (): Promise<ProviderDetection> => fakeDetection(available)),
    getCapabilities: vi.fn(async (): Promise<ProviderCapability[]> => [
      { name: "review", operations, synchronous: true },
    ]),
    execute: executeSpy,
  };
}

function buildRegistry(delegates: ProviderDelegate[]): DefaultDelegationRegistry {
  const registry = new DefaultDelegationRegistry();
  for (const delegate of delegates) {
    registry.register({ id: delegate.id, delegate, capabilities: flagsFor(delegate.id) });
  }
  return registry;
}

// ── toPortableRef ─────────────────────────────────────────────────────────────

describe("toPortableRef", () => {
  it("returns the ref unchanged when it is not an absolute path", () => {
    expect(toPortableRef("awesome-copilot:skill:x")).toBe("awesome-copilot:skill:x");
    expect(toPortableRef("vendor/skills/foo/SKILL.md")).toBe("vendor/skills/foo/SKILL.md");
    expect(toPortableRef("engram:memory:abc")).toBe("engram:memory:abc");
  });

  it("returns undefined for Windows absolute paths", () => {
    expect(toPortableRef("D:\\Adrian\\Projects\\foo")).toBeUndefined();
    expect(toPortableRef("C:/Users/foo/bar")).toBeUndefined();
  });

  it("returns undefined for POSIX absolute paths", () => {
    expect(toPortableRef("/home/user/foo")).toBeUndefined();
    expect(toPortableRef("/tmp/artifact.json")).toBeUndefined();
  });
});

// ── portableRequest ───────────────────────────────────────────────────────────

describe("portableRequest", () => {
  it("builds a valid request with defaults", () => {
    const req = portableRequest({ operation: "consult", prompt: "review this" });
    expect(req.operation).toBe("consult");
    expect(req.prompt).toBe("review this");
    expect(req.contextRefs).toEqual([]);
    expect(req.artifactRefs).toEqual([]);
    expect(req.constraints).toEqual([]);
    expect(req.taskId).toMatch(/^del_\d+_/);
  });

  it("uses provided taskId when given", () => {
    const req = portableRequest({ operation: "consult", prompt: "p", taskId: "my-task-1" });
    expect(req.taskId).toBe("my-task-1");
  });

  it("drops absolute-path context refs silently", () => {
    const req = portableRequest({
      operation: "consult",
      prompt: "p",
      contextRefs: [
        { kind: "artifact", ref: "D:\\absolute\\path" },
        { kind: "spec", ref: "spec/my-spec.md" },
      ],
    });
    expect(req.contextRefs).toHaveLength(1);
    expect(req.contextRefs[0].ref).toBe("spec/my-spec.md");
  });

  it("drops absolute-path artifact refs silently", () => {
    const req = portableRequest({
      operation: "consult",
      prompt: "p",
      artifactRefs: ["/home/user/out.json", "relative/ref.json"],
    });
    expect(req.artifactRefs).toHaveLength(1);
    expect(req.artifactRefs[0]).toBe("relative/ref.json");
  });

  it("forwards timeoutMs and metadata", () => {
    const req = portableRequest({
      operation: "consult",
      prompt: "p",
      timeoutMs: 5000,
      metadata: { phase: "apply" },
    });
    expect(req.timeoutMs).toBe(5000);
    expect(req.metadata?.phase).toBe("apply");
  });
});

// ── portableResult ────────────────────────────────────────────────────────────

describe("portableResult", () => {
  it("wraps a result with a stable runId", () => {
    const raw: ProviderExecutionResult = {
      providerId: "ecc",
      invocationId: "inv-123",
      status: "COMPLETED",
      output: "done",
      artifacts: [],
    };
    const result = portableResult(raw);
    expect(result.runId).toBeTruthy();
    expect(result.runId).toMatch(/^inv_ecc_/);
    expect(result.providerId).toBe("ecc");
    expect(result.status).toBe("COMPLETED");
  });

  it("strips absolute paths from artifacts", () => {
    const raw: ProviderExecutionResult = {
      providerId: "ecc",
      invocationId: "inv-1",
      status: "COMPLETED",
      artifacts: ["D:\\absolute\\out.json", "logical:ref:ok", "/posix/absolute"],
    };
    const result = portableResult(raw);
    expect(result.artifacts).toEqual(["logical:ref:ok"]);
  });

  it("preserves logical artifact refs unchanged", () => {
    const raw: ProviderExecutionResult = {
      providerId: "ruflo",
      invocationId: "inv-2",
      status: "SUBMITTED",
      artifacts: ["ruflo:workflow:wf-123:submitted"],
    };
    const result = portableResult(raw);
    expect(result.artifacts).toContain("ruflo:workflow:wf-123:submitted");
  });
});

// ── DelegationOrchestrator — direct dispatch ──────────────────────────────────

describe("DelegationOrchestrator — direct dispatch (providerId given)", () => {
  it("dispatches to the named provider when available", async () => {
    const executeSpy = vi.fn(async (_req: ProviderExecutionRequest): Promise<ProviderExecutionResult> => ({
      providerId: "ecc",
      invocationId: "inv-direct",
      status: "COMPLETED",
      output: "advisory output",
      artifacts: [],
    }));
    const delegate = fakeDelegate({ id: "ecc", available: true, executeSpy });
    const registry = buildRegistry([delegate]);
    const orchestrator = new DelegationOrchestrator(registry);

    const result = await orchestrator.delegate({ operation: "consult", prompt: "review this", providerId: "ecc" });

    expect(result.status).toBe("COMPLETED");
    expect(result.output).toBe("advisory output");
    expect(executeSpy).toHaveBeenCalledOnce();
  });

  it("returns UNAVAILABLE when named provider is not registered", async () => {
    const registry = buildRegistry([]);
    const orchestrator = new DelegationOrchestrator(registry);

    const result = await orchestrator.delegate({ operation: "consult", prompt: "p", providerId: "ecc" });

    expect(result.status).toBe("UNAVAILABLE");
    expect(result.error).toMatch(/not registered/);
  });

  it("returns UNAVAILABLE when named provider is registered but detect() → not available", async () => {
    const delegate = fakeDelegate({ id: "ecc", available: false });
    const registry = buildRegistry([delegate]);
    const orchestrator = new DelegationOrchestrator(registry);

    const result = await orchestrator.delegate({ operation: "consult", prompt: "p", providerId: "ecc" });

    expect(result.status).toBe("UNAVAILABLE");
  });

  it("propagates FAILED result from provider", async () => {
    const executeSpy = vi.fn(async (): Promise<ProviderExecutionResult> => ({
      providerId: "ecc",
      invocationId: "inv-fail",
      status: "FAILED",
      error: "provider error",
      artifacts: [],
    }));
    const delegate = fakeDelegate({ id: "ecc", available: true, executeSpy });
    const registry = buildRegistry([delegate]);
    const orchestrator = new DelegationOrchestrator(registry);

    const result = await orchestrator.delegate({ operation: "consult", prompt: "p", providerId: "ecc" });

    expect(result.status).toBe("FAILED");
    expect(result.error).toBe("provider error");
  });

  it("includes a stable runId in every result", async () => {
    const delegate = fakeDelegate({ id: "ecc", available: true });
    const registry = buildRegistry([delegate]);
    const orchestrator = new DelegationOrchestrator(registry);

    const result = await orchestrator.delegate({ operation: "consult", prompt: "p", providerId: "ecc" });

    expect(result.runId).toBeTruthy();
    expect(typeof result.runId).toBe("string");
  });

  it("strips absolute paths from result artifacts", async () => {
    const executeSpy = vi.fn(async (): Promise<ProviderExecutionResult> => ({
      providerId: "ecc",
      invocationId: "inv-abs",
      status: "COMPLETED",
      artifacts: ["D:\\absolute\\path", "logical:ref:ok"],
    }));
    const delegate = fakeDelegate({ id: "ecc", available: true, executeSpy });
    const registry = buildRegistry([delegate]);
    const orchestrator = new DelegationOrchestrator(registry);

    const result = await orchestrator.delegate({ operation: "consult", prompt: "p", providerId: "ecc" });

    expect(result.artifacts).not.toContain("D:\\absolute\\path");
    expect(result.artifacts).toContain("logical:ref:ok");
  });
});

// ── DelegationOrchestrator — auto-resolve ─────────────────────────────────────

describe("DelegationOrchestrator — auto-resolve (no providerId)", () => {
  it("resolves and dispatches to the first available provider supporting the operation", async () => {
    const executeSpy = vi.fn(async (): Promise<ProviderExecutionResult> => ({
      providerId: "ecc",
      invocationId: "inv-auto",
      status: "COMPLETED",
      output: "resolved output",
      artifacts: [],
    }));
    const delegate = fakeDelegate({ id: "ecc", available: true, operations: ["consult"], executeSpy });
    const registry = buildRegistry([delegate]);
    const orchestrator = new DelegationOrchestrator(registry);

    const result = await orchestrator.delegate({ operation: "consult", prompt: "auto-resolve" });

    expect(result.status).toBe("COMPLETED");
    expect(executeSpy).toHaveBeenCalledOnce();
  });

  it("returns BLOCKED when no provider supports the operation", async () => {
    const delegate = fakeDelegate({ id: "ecc", available: true, operations: ["consult"] });
    const registry = buildRegistry([delegate]);
    const orchestrator = new DelegationOrchestrator(registry);

    const result = await orchestrator.delegate({ operation: "memory.store", prompt: "p" });

    expect(result.status).toBe("BLOCKED");
    expect(result.error).toMatch(/memory\.store/);
  });

  it("returns BLOCKED when all providers are unavailable", async () => {
    const delegate = fakeDelegate({ id: "ecc", available: false, operations: ["consult"] });
    const registry = buildRegistry([delegate]);
    const orchestrator = new DelegationOrchestrator(registry);

    const result = await orchestrator.delegate({ operation: "consult", prompt: "p" });

    expect(result.status).toBe("BLOCKED");
  });
});

// ── createOrchestratorFromRegistry factory ────────────────────────────────────

describe("createOrchestratorFromRegistry", () => {
  it("returns a DelegationOrchestrator instance", () => {
    const registry = buildRegistry([]);
    const orchestrator = createOrchestratorFromRegistry(registry);
    expect(orchestrator).toBeInstanceOf(DelegationOrchestrator);
  });

  it("the returned instance delegates correctly", async () => {
    const delegate = fakeDelegate({ id: "ecc", available: true });
    const registry = buildRegistry([delegate]);
    const orchestrator = createOrchestratorFromRegistry(registry);

    const result = await orchestrator.delegate({ operation: "consult", prompt: "p", providerId: "ecc" });
    expect(result.status).toBe("COMPLETED");
  });
});

// ── Constraints and context refs forwarding ───────────────────────────────────

describe("DelegationOrchestrator — request forwarding", () => {
  it("forwards constraints to the delegate execute() call", async () => {
    const executeSpy = vi.fn(async (req: ProviderExecutionRequest): Promise<ProviderExecutionResult> => ({
      providerId: "ecc",
      invocationId: "inv-c",
      status: "COMPLETED",
      output: `constraints: ${req.constraints.join(",")}`,
      artifacts: [],
    }));
    const delegate = fakeDelegate({ id: "ecc", available: true, executeSpy });
    const registry = buildRegistry([delegate]);
    const orchestrator = new DelegationOrchestrator(registry);

    const result = await orchestrator.delegate({
      operation: "consult",
      prompt: "p",
      providerId: "ecc",
      constraints: ["no-irreversible", "max-risk:2"],
    });

    expect(executeSpy).toHaveBeenCalledOnce();
    const passedReq = executeSpy.mock.calls[0][0] as ProviderExecutionRequest;
    expect(passedReq.constraints).toContain("no-irreversible");
    expect(passedReq.constraints).toContain("max-risk:2");
    expect(result.status).toBe("COMPLETED");
  });

  it("drops absolute context refs before forwarding", async () => {
    const executeSpy = vi.fn(async (req: ProviderExecutionRequest): Promise<ProviderExecutionResult> => ({
      providerId: "ecc",
      invocationId: "inv-ctx",
      status: "COMPLETED",
      output: `refs: ${req.contextRefs.map((r) => r.ref).join(",")}`,
      artifacts: [],
    }));
    const delegate = fakeDelegate({ id: "ecc", available: true, executeSpy });
    const registry = buildRegistry([delegate]);
    const orchestrator = new DelegationOrchestrator(registry);

    await orchestrator.delegate({
      operation: "consult",
      prompt: "p",
      providerId: "ecc",
      contextRefs: [
        { kind: "artifact", ref: "D:\\absolute\\path.json" },
        { kind: "spec", ref: "openspec/changes/my-change/spec.md" },
      ],
    });

    const passedReq = executeSpy.mock.calls[0][0] as ProviderExecutionRequest;
    expect(passedReq.contextRefs).toHaveLength(1);
    expect(passedReq.contextRefs[0].ref).toBe("openspec/changes/my-change/spec.md");
  });

  it("forwards timeoutMs to the request", async () => {
    const executeSpy = vi.fn(async (req: ProviderExecutionRequest): Promise<ProviderExecutionResult> => ({
      providerId: "ecc",
      invocationId: "inv-t",
      status: "COMPLETED",
      artifacts: [],
      metadata: { receivedTimeout: req.timeoutMs },
    }));
    const delegate = fakeDelegate({ id: "ecc", available: true, executeSpy });
    const registry = buildRegistry([delegate]);
    const orchestrator = new DelegationOrchestrator(registry);

    await orchestrator.delegate({
      operation: "consult",
      prompt: "p",
      providerId: "ecc",
      timeoutMs: 10000,
    });

    const passedReq = executeSpy.mock.calls[0][0] as ProviderExecutionRequest;
    expect(passedReq.timeoutMs).toBe(10000);
  });
});
