/**
 * deepagents-harness.test.ts
 *
 * Verifies the DeepAgents host-managed path delegates to the active
 * HarnessAdapter (SDD S6) and NEVER opens a secondary SDK connection:
 *
 *   - host-managed + ready adapter  → available, run() delegates to adapter.
 *   - host-managed + stub adapter   → adapter-missing, no SDK fallback.
 *   - the kernel registry resolves the real ClaudeHarnessAdapter for "claude"
 *     and a conservative StubHarnessAdapter for unimplemented harnesses.
 *   - disabled mode stays disabled.
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { DeepagentsProvider } from "../packages/providers/deepagents/src/index.js";
import {
  resolveHarnessAdapter,
  StubHarnessAdapter,
} from "../packages/kernel/src/adapters/harness-registry.js";
import { ClaudeHarnessAdapter } from "../packages/kernel/src/adapters/harness-claude.js";
import type {
  HarnessAdapter,
  HarnessId,
} from "../packages/shared/src/ports/harness.js";

// A controllable ready adapter that records whether execute() ran.
function makeReadyAdapter(id: HarnessId, output: string) {
  let executed = false;
  const adapter: HarnessAdapter = {
    id,
    async checkAvailability() {
      return { status: "ready" };
    },
    supports() {
      return true;
    },
    async getContext() {
      return { harness: id, modelControl: "host-managed", capabilities: [] };
    },
    async execute() {
      executed = true;
      return {
        success: true,
        output,
        harness: id,
        execution: { adapter: id, runtimeMode: "host-managed" as const },
      };
    },
  };
  return { adapter, didExecute: () => executed };
}

describe("DeepAgents host-managed delegation (SDD S6)", () => {
  let savedMode: string | undefined;

  beforeEach(() => {
    savedMode = process.env.GRU_DEEPAGENTS_MODE;
  });

  afterEach(() => {
    if (savedMode === undefined) delete process.env.GRU_DEEPAGENTS_MODE;
    else process.env.GRU_DEEPAGENTS_MODE = savedMode;
  });

  test("host-managed + ready adapter → available, delegates without SDK", async () => {
    process.env.GRU_DEEPAGENTS_MODE = "host-managed";
    const { adapter, didExecute } = makeReadyAdapter("claude", "OK-from-harness");

    const provider = new DeepagentsProvider({
      detect: () => "claude",
      resolveAdapter: () => adapter,
    });

    const avail = await provider.checkAvailability();
    expect(avail.available).toBe(true);
    expect(avail.status).toBe("ready");
    expect(avail.executable).toBe("harness:claude (host-managed)");

    const result = await provider.run({ taskId: "t1", prompt: "run a workflow" });
    expect(result.success).toBe(true);
    expect(result.output).toBe("OK-from-harness"); // proves adapter ran, not SDK
    expect(result.executedCommand).toContain("host-managed, no SDK");
    expect(didExecute()).toBe(true);
  });

  test("host-managed + stub adapter (codex) → adapter-missing, no SDK fallback", async () => {
    process.env.GRU_DEEPAGENTS_MODE = "host-managed";

    // Use the real registry → codex resolves to a StubHarnessAdapter.
    const provider = new DeepagentsProvider({ detect: () => "codex" });

    const avail = await provider.checkAvailability();
    expect(avail.available).toBe(false);
    expect(avail.status).toBe("adapter-missing");
    expect(avail.reason).toContain("No se abre conexión SDK");

    const result = await provider.run({ taskId: "t2", prompt: "run a workflow" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("HarnessAdapter");
    expect(result.error).toContain("No se abre conexión SDK");
  });

  test("disabled mode stays disabled", async () => {
    process.env.GRU_DEEPAGENTS_MODE = "disabled";
    const provider = new DeepagentsProvider({ detect: () => "claude" });
    const avail = await provider.checkAvailability();
    expect(avail.available).toBe(false);
    expect(avail.status).toBe("missing");
  });
});

describe("HarnessAdapter registry", () => {
  test("resolves real ClaudeHarnessAdapter for 'claude'", () => {
    const adapter = resolveHarnessAdapter("claude");
    expect(adapter).toBeInstanceOf(ClaudeHarnessAdapter);
    expect(adapter.id).toBe("claude");
  });

  test("resolves conservative StubHarnessAdapter for unimplemented harnesses", async () => {
    for (const id of ["codex", "gemini", "pi", "standalone"] as const) {
      const adapter = resolveHarnessAdapter(id);
      expect(adapter).toBeInstanceOf(StubHarnessAdapter);
      expect(adapter.id).toBe(id);
      expect(adapter.supports("native-subagents")).toBe(false);
      const avail = await adapter.checkAvailability();
      expect(avail.status).toBe("unsupported");
    }
  });
});
