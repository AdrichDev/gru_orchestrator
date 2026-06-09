import { describe, it, expect } from "vitest";
import { GentlemanProviderAdapter } from "../gentleman.js";

function unavailableExeca() {
  return Object.assign(
    () => Promise.reject(new Error("gentle-ai not found")),
    { command: "" },
  ) as unknown as typeof import("execa").execa;
}

function successExeca(stdout = "1.0.0") {
  return (() =>
    Promise.resolve({ exitCode: 0, stdout, stderr: "" })
  ) as unknown as typeof import("execa").execa;
}

function failExeca(stderr = "validate error") {
  return (() =>
    Promise.resolve({ exitCode: 1, stdout: "", stderr })
  ) as unknown as typeof import("execa").execa;
}

describe("GentlemanProviderAdapter", () => {
  // ── Availability ──────────────────────────────────────────────────────────

  it("CLI absent → unsupported (no throw)", async () => {
    const a = new GentlemanProviderAdapter(unavailableExeca());
    const status = await a.checkAvailability();
    expect(status.status).toBe("unsupported");
  });

  it("CLI absent → reason provided", async () => {
    const a = new GentlemanProviderAdapter(unavailableExeca());
    const status = await a.checkAvailability();
    expect(status.reason).toBeTruthy();
  });

  it("CLI present → available", async () => {
    const a = new GentlemanProviderAdapter(successExeca());
    const status = await a.checkAvailability();
    expect(status.status).toBe("available");
  });

  it("id is 'gentlemanCli'", () => {
    expect(new GentlemanProviderAdapter().id).toBe("gentlemanCli");
  });

  // ── Catalog ──────────────────────────────────────────────────────────────

  it("catalog has agents for all SDD phases", async () => {
    const a = new GentlemanProviderAdapter(successExeca());
    const catalog = a.getCatalog();
    const agents = await catalog.listAgents();
    const phases = agents.flatMap((ag) => ag.supportedPhases);
    const expected = ["explore", "proposal", "spec", "design", "tasks", "apply", "verify", "sync", "archive"];
    for (const p of expected) {
      expect(phases).toContain(p);
    }
  });

  it("catalog agents: canWrite=false, canReview=false, canTest=false", async () => {
    const a = new GentlemanProviderAdapter(successExeca());
    const agents = await a.getCatalog().listAgents();
    for (const ag of agents) {
      expect(ag.canWrite).toBe(false);
      expect(ag.canReview).toBe(false);
      expect(ag.canTest).toBe(false);
    }
  });

  it("findByPhase('spec') returns spec agent", async () => {
    const a = new GentlemanProviderAdapter(successExeca());
    const found = await a.getCatalog().findByPhase("spec");
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].supportedPhases).toContain("spec");
  });

  // ── Execute ───────────────────────────────────────────────────────────────

  it("execute when unavailable → success false", async () => {
    const a = new GentlemanProviderAdapter(unavailableExeca());
    const result = await a.execute({
      id: "a1",
      task: { id: "t1", prompt: "my-sdd" },
      phase: "spec",
      executor: {} as never,
      reviewer: {} as never,
      tester: {} as never,
      scope: [],
      gates: [],
    });
    expect(result.success).toBe(false);
  });

  it("execute when unavailable → never fabricates output", async () => {
    const a = new GentlemanProviderAdapter(unavailableExeca());
    const result = await a.execute({
      id: "a1",
      task: { id: "t1", prompt: "my-sdd" },
      phase: "spec",
      executor: {} as never,
      reviewer: {} as never,
      tester: {} as never,
      scope: [],
      gates: [],
    });
    expect(result.output).toBe("");
  });

  it("execute success → success true + stdout as output", async () => {
    let capturedArgs: string[] = [];
    const capturingExeca = ((cmd: string, args: string[]) => {
      capturedArgs = args;
      return Promise.resolve({ exitCode: 0, stdout: "OK", stderr: "" });
    }) as unknown as typeof import("execa").execa;

    const a = new GentlemanProviderAdapter(capturingExeca);
    const result = await a.execute({
      id: "a1",
      task: { id: "t1", prompt: "my-sdd-id" },
      phase: "design",
      executor: {} as never,
      reviewer: {} as never,
      tester: {} as never,
      scope: [],
      gates: [],
    });
    expect(result.success).toBe(true);
    expect(result.output).toBe("OK");
    expect(capturedArgs).toContain("my-sdd-id");
    expect(capturedArgs).toContain("design");
  });

  it("execute CLI failure → success false + error set", async () => {
    // First call (--version) succeeds, second call (validate) fails
    const mockExeca = ((cmd: string, args: string[]) => {
      if (args[0] === "--version") return Promise.resolve({ exitCode: 0, stdout: "1.0.0", stderr: "" });
      return Promise.resolve({ exitCode: 1, stdout: "", stderr: "missing spec.md" });
    }) as unknown as typeof import("execa").execa;

    const a = new GentlemanProviderAdapter(mockExeca);
    const result = await a.execute({
      id: "a1",
      task: { id: "t1", prompt: "my-sdd" },
      phase: "spec",
      executor: {} as never,
      reviewer: {} as never,
      tester: {} as never,
      scope: [],
      gates: [],
    });
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain("missing spec.md");
  });
});
