import { describe, it, expect } from "vitest";
import { StrictHarnessController } from "../strict-harness-controller.js";
import type { HarnessAdapter, HarnessAvailability, HarnessContext, GruTask, GruResult, GruCapability } from "../../../../shared/src/ports/harness.js";

// ── Fake harnesses ────────────────────────────────────────────────────────────

function fakeHarness(opts: {
  available: boolean;
  capabilities?: GruCapability[];
}): HarnessAdapter {
  const caps = opts.capabilities ?? [
    "file-tools", "native-subagents", "code-execution", "web-search", "streaming",
  ];
  return {
    id: "claude" as const,
    async checkAvailability(): Promise<HarnessAvailability> {
      return opts.available
        ? { status: "ready" }
        : { status: "unsupported", reason: "not claude harness" };
    },
    supports(cap: GruCapability): boolean {
      return caps.includes(cap);
    },
    async getContext(): Promise<HarnessContext> {
      return { harness: "claude", modelControl: "host-managed", capabilities: caps };
    },
    async execute(task: GruTask): Promise<GruResult> {
      return { success: true, output: task.prompt, harness: "claude", execution: { adapter: "claude", runtimeMode: "host-managed" } };
    },
  };
}

const readyHarness = fakeHarness({ available: true });
const unavailableHarness = fakeHarness({ available: false });
const limitedHarness = fakeHarness({
  available: true,
  capabilities: ["file-tools", "code-execution"],
  // native-subagents intentionally excluded
});

// ── R1 — Harness unavailable ───────────────────────────────────────────────────

describe("harness unavailable", () => {
  it("unavailable harness → allowed false", async () => {
    const ctrl = new StrictHarnessController(unavailableHarness);
    const r = await ctrl.gate("any task");
    expect(r.allowed).toBe(false);
  });

  it("unavailable harness → BLOCKED in blockers", async () => {
    const ctrl = new StrictHarnessController(unavailableHarness);
    const r = await ctrl.gate("any task");
    expect(r.blockers.some((b) => b.includes("BLOCKED"))).toBe(true);
  });

  it("unavailable harness → viability blocked", async () => {
    const ctrl = new StrictHarnessController(unavailableHarness);
    const r = await ctrl.gate("any task");
    expect(r.classification.viability).toBe("blocked");
  });

  it("unavailable harness → missingCapability is harness-unavailable", async () => {
    const ctrl = new StrictHarnessController(unavailableHarness);
    const r = await ctrl.gate("any task");
    expect(r.classification.signals.missingCapability).toBe("harness-unavailable");
  });
});

// ── R2 — Trivial task, ready harness ──────────────────────────────────────────

describe("trivial task with ready harness", () => {
  it("allowed true", async () => {
    const ctrl = new StrictHarnessController(readyHarness);
    const r = await ctrl.gate("add comment");
    expect(r.allowed).toBe(true);
  });

  it("empty blockers", async () => {
    const ctrl = new StrictHarnessController(readyHarness);
    const r = await ctrl.gate("add comment");
    expect(r.blockers).toHaveLength(0);
  });

  it("classification included in result", async () => {
    const ctrl = new StrictHarnessController(readyHarness);
    const r = await ctrl.gate("add comment");
    expect(r.classification.level).toBe(0);
    expect(r.classification.viability).toBe("ready");
    expect(r.classification.suggestedMinions).toContain("minion-builder");
  });
});

// ── R3 — needs_approval gate ──────────────────────────────────────────────────

describe("needs_approval", () => {
  const productionSignals = { touchesProduction: true };

  it("no forceApproval → allowed false", async () => {
    const ctrl = new StrictHarnessController(readyHarness);
    const r = await ctrl.gate("deploy", productionSignals);
    expect(r.allowed).toBe(false);
  });

  it("no forceApproval → NEEDS_APPROVAL in blockers", async () => {
    const ctrl = new StrictHarnessController(readyHarness);
    const r = await ctrl.gate("deploy", productionSignals);
    expect(r.blockers.some((b) => b.includes("NEEDS_APPROVAL"))).toBe(true);
  });

  it("forceApproval true → allowed true", async () => {
    const ctrl = new StrictHarnessController(readyHarness);
    const r = await ctrl.gate("deploy", productionSignals, { forceApproval: true });
    expect(r.allowed).toBe(true);
  });

  it("forceApproval true → empty blockers", async () => {
    const ctrl = new StrictHarnessController(readyHarness);
    const r = await ctrl.gate("deploy", productionSignals, { forceApproval: true });
    expect(r.blockers).toHaveLength(0);
  });

  it("security signal → needs_approval, blocked without force", async () => {
    const ctrl = new StrictHarnessController(readyHarness);
    const r = await ctrl.gate("fix auth", { touchesSecurityOrAuth: true });
    expect(r.allowed).toBe(false);
    expect(r.blockers.some((b) => b.includes("NEEDS_APPROVAL"))).toBe(true);
  });

  it("irreversible signal → needs_approval, allowed with force", async () => {
    const ctrl = new StrictHarnessController(readyHarness);
    const r = await ctrl.gate("drop table", { isIrreversible: true }, { forceApproval: true });
    expect(r.allowed).toBe(true);
  });
});

// ── R4 — Capability check ─────────────────────────────────────────────────────

describe("capability check", () => {
  it("level 3+, limited harness (no native-subagents) → blocked", async () => {
    const ctrl = new StrictHarnessController(limitedHarness);
    // filesAffected=4 (+2) + domainsCrossed=2 (+2) + newArch (+2) = 6 → level 3
    const r = await ctrl.gate("cross-domain refactor", {
      filesAffected: 4,
      domainsCrossed: 2,
      requiresNewArchitecture: true,
    });
    expect(r.allowed).toBe(false);
    expect(r.classification.viability).toBe("blocked");
    expect(r.classification.signals.missingCapability).toBe("native-subagents");
  });

  it("level 3+, full harness (has native-subagents) → allowed", async () => {
    const ctrl = new StrictHarnessController(readyHarness);
    const r = await ctrl.gate("cross-domain refactor", {
      filesAffected: 4,
      domainsCrossed: 2,
      requiresNewArchitecture: true,
    });
    expect(r.allowed).toBe(true);
    expect(r.classification.signals.missingCapability).toBeUndefined();
  });

  it("level 2, limited harness (no native-subagents) → not affected, allowed", async () => {
    const ctrl = new StrictHarnessController(limitedHarness);
    // filesAffected=3 (+1) + domainsCrossed=2 (+2) = 3 → level 2
    const r = await ctrl.gate("update two domains", {
      filesAffected: 3,
      domainsCrossed: 2,
    });
    // level 2 doesn't require native-subagents
    expect(r.classification.level).toBe(2);
    expect(r.classification.signals.missingCapability).toBeUndefined();
    expect(r.allowed).toBe(true);
  });

  it("explicit missingCapability in signals is not overwritten by harness check", async () => {
    const ctrl = new StrictHarnessController(readyHarness);
    // caller already knows something is missing
    const r = await ctrl.gate("spawn agents", {
      filesAffected: 4,
      domainsCrossed: 2,
      missingCapability: "custom-provider",
    });
    expect(r.classification.signals.missingCapability).toBe("custom-provider");
    expect(r.allowed).toBe(false);
  });
});

// ── R5 — GateResult structure ─────────────────────────────────────────────────

describe("gate result structure", () => {
  it("result has allowed, classification, blockers", async () => {
    const ctrl = new StrictHarnessController(readyHarness);
    const r = await ctrl.gate("any");
    expect(typeof r.allowed).toBe("boolean");
    expect(r.classification).toBeTruthy();
    expect(Array.isArray(r.blockers)).toBe(true);
  });

  it("classification has suggestedMinions", async () => {
    const ctrl = new StrictHarnessController(readyHarness);
    const r = await ctrl.gate("any");
    expect(Array.isArray(r.classification.suggestedMinions)).toBe(true);
  });
});

// ── R6 — No throws ────────────────────────────────────────────────────────────

describe("no throws", () => {
  it("trivial inputs do not throw", async () => {
    const ctrl = new StrictHarnessController(readyHarness);
    await expect(ctrl.gate("")).resolves.toBeTruthy();
  });

  it("unavailable harness does not throw", async () => {
    const ctrl = new StrictHarnessController(unavailableHarness);
    await expect(ctrl.gate("any")).resolves.toBeTruthy();
  });

  it("all risk signals combined do not throw", async () => {
    const ctrl = new StrictHarnessController(readyHarness);
    await expect(ctrl.gate("risky task", {
      filesAffected: 10,
      domainsCrossed: 5,
      isIrreversible: true,
      touchesProduction: true,
      touchesSecurityOrAuth: true,
      generatesFinancialCost: true,
    })).resolves.toBeTruthy();
  });
});
