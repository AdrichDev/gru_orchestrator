import { describe, it, expect } from "vitest";
import { ClaudeHarnessAdapter } from "../harness-claude.js";

function adapter(detectedHarness: string) {
  return new ClaudeHarnessAdapter(() => detectedHarness);
}

// ── R5 — Identity ──────────────────────────────────────────────────────────────

describe("identity", () => {
  it("id is 'claude'", () => {
    expect(new ClaudeHarnessAdapter().id).toBe("claude");
  });
});

// ── R1 — Availability ─────────────────────────────────────────────────────────

describe("checkAvailability", () => {
  it("detect 'claude' → ready", async () => {
    const avail = await adapter("claude").checkAvailability();
    expect(avail.status).toBe("ready");
  });

  it("detect 'standalone' → unsupported", async () => {
    const avail = await adapter("standalone").checkAvailability();
    expect(avail.status).toBe("unsupported");
  });

  it("unsupported reason mentions detected harness", async () => {
    const avail = await adapter("gemini").checkAvailability();
    expect(avail.status).toBe("unsupported");
    expect(avail.reason).toMatch(/gemini/);
  });

  it("detect 'codex' → unsupported (not claude)", async () => {
    const avail = await adapter("codex").checkAvailability();
    expect(avail.status).toBe("unsupported");
  });

  it("detect 'pi' → unsupported (not claude)", async () => {
    const avail = await adapter("pi").checkAvailability();
    expect(avail.status).toBe("unsupported");
  });
});

// ── R2 — Capabilities ─────────────────────────────────────────────────────────

describe("supports", () => {
  const a = new ClaudeHarnessAdapter();

  it("file-tools → true", () => {
    expect(a.supports("file-tools")).toBe(true);
  });

  it("native-subagents → true", () => {
    expect(a.supports("native-subagents")).toBe(true);
  });

  it("code-execution → true", () => {
    expect(a.supports("code-execution")).toBe(true);
  });

  it("web-search → true", () => {
    expect(a.supports("web-search")).toBe(true);
  });

  it("streaming → false (stream() not yet implemented)", () => {
    expect(a.supports("streaming")).toBe(false);
  });

  it("memory → false (not wired in this phase)", () => {
    expect(a.supports("memory")).toBe(false);
  });

  it("approval-flow → false (not wired in this phase)", () => {
    expect(a.supports("approval-flow")).toBe(false);
  });

  it("documentation-retrieval → false", () => {
    expect(a.supports("documentation-retrieval")).toBe(false);
  });

  it("context-enrichment → false", () => {
    expect(a.supports("context-enrichment")).toBe(false);
  });
});

// ── R3 — Context ──────────────────────────────────────────────────────────────

describe("getContext", () => {
  it("harness is 'claude'", async () => {
    const ctx = await new ClaudeHarnessAdapter().getContext();
    expect(ctx.harness).toBe("claude");
  });

  it("modelControl is 'host-managed'", async () => {
    const ctx = await new ClaudeHarnessAdapter().getContext();
    expect(ctx.modelControl).toBe("host-managed");
  });

  it("capabilities include file-tools and native-subagents", async () => {
    const ctx = await new ClaudeHarnessAdapter().getContext();
    expect(ctx.capabilities).toContain("file-tools");
    expect(ctx.capabilities).toContain("native-subagents");
  });

  it("capabilities include code-execution and web-search", async () => {
    const ctx = await new ClaudeHarnessAdapter().getContext();
    expect(ctx.capabilities).toContain("code-execution");
    expect(ctx.capabilities).toContain("web-search");
  });

  it("capabilities do NOT include memory or approval-flow", async () => {
    const ctx = await new ClaudeHarnessAdapter().getContext();
    expect(ctx.capabilities).not.toContain("memory");
    expect(ctx.capabilities).not.toContain("approval-flow");
  });
});

// ── R4 — Execute ──────────────────────────────────────────────────────────────

describe("execute", () => {
  const task = { id: "t1", prompt: "do something" };

  it("when available → success true", async () => {
    const result = await adapter("claude").execute(task);
    expect(result.success).toBe(true);
  });

  it("when available → runtimeMode host-managed", async () => {
    const result = await adapter("claude").execute(task);
    expect(result.execution.runtimeMode).toBe("host-managed");
  });

  it("when available → adapter is 'claude'", async () => {
    const result = await adapter("claude").execute(task);
    expect(result.execution.adapter).toBe("claude");
  });

  it("when available → harness is 'claude'", async () => {
    const result = await adapter("claude").execute(task);
    expect(result.harness).toBe("claude");
  });

  it("when unavailable → success false", async () => {
    const result = await adapter("standalone").execute(task);
    expect(result.success).toBe(false);
  });

  it("when unavailable → error.code HARNESS_UNAVAILABLE", async () => {
    const result = await adapter("standalone").execute(task);
    expect(result.error?.code).toBe("HARNESS_UNAVAILABLE");
  });

  it("when unavailable → error.recoverable false", async () => {
    const result = await adapter("gemini").execute(task);
    expect(result.error?.recoverable).toBe(false);
  });

  it("when unavailable → error.message not empty", async () => {
    const result = await adapter("standalone").execute(task);
    expect(result.error?.message).toBeTruthy();
  });
});
