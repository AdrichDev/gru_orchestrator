import { describe, it, expect } from "vitest";
import { buildDelegationReport, deriveDevilsFindings } from "../report-builder.js";
import { classifyTask } from "../classifier.js";
import type { ProviderExecutionResult } from "../../../../shared/src/ports/delegation.js";

const resolved = { blocked: false as const, delegateId: "ecc" as const };
const blockedResolution = { blocked: true as const, reason: "no delegate supports op" };

function completedExecution(taskId = "t1"): ProviderExecutionResult {
  return {
    providerId: "ecc",
    invocationId: `inv-${taskId}`,
    status: "COMPLETED",
    output: "done",
  };
}

function failedExecution(): ProviderExecutionResult {
  return {
    providerId: "ecc",
    invocationId: "inv-fail",
    status: "FAILED",
    error: "something broke",
  };
}

// ── R1 — Structure ────────────────────────────────────────────────────────────

describe("report structure", () => {
  it("required fields are present", () => {
    const r = buildDelegationReport({
      taskId: "t1",
      prompt: "add comment",
      classification: classifyTask("add comment"),
      resolution: resolved,
    });
    expect(r.taskId).toBe("t1");
    expect(r.prompt).toBe("add comment");
    expect(r.timestamp).toBeTruthy();
    expect(r.classification).toBeTruthy();
    expect(typeof r.delegationBlocked).toBe("boolean");
    expect(Array.isArray(r.devilsFindings)).toBe(true);
    expect(Array.isArray(r.blockers)).toBe(true);
    expect(typeof r.approved).toBe("boolean");
  });

  it("timestamp is ISO-8601", () => {
    const r = buildDelegationReport({
      taskId: "t1",
      prompt: "p",
      classification: classifyTask("p"),
      resolution: resolved,
    });
    expect(r.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ── R2 — Delegation resolution ────────────────────────────────────────────────

describe("delegation resolution", () => {
  it("resolved → resolvedDelegate present, delegationBlocked false", () => {
    const r = buildDelegationReport({
      taskId: "t1",
      prompt: "p",
      classification: classifyTask("p"),
      resolution: resolved,
    });
    expect(r.resolvedDelegate).toBe("ecc");
    expect(r.delegationBlocked).toBe(false);
    expect(r.delegationBlockedReason).toBeUndefined();
  });

  it("blocked → resolvedDelegate undefined, delegationBlocked true", () => {
    const r = buildDelegationReport({
      taskId: "t1",
      prompt: "p",
      classification: classifyTask("p"),
      resolution: blockedResolution,
    });
    expect(r.resolvedDelegate).toBeUndefined();
    expect(r.delegationBlocked).toBe(true);
    expect(r.delegationBlockedReason).toBe("no delegate supports op");
  });
});

// ── R3 — Devil's findings ─────────────────────────────────────────────────────

describe("deriveDevilsFindings", () => {
  it("level 0 → empty (devil not active)", () => {
    const c = classifyTask("add comment");
    expect(c.requiresDevilsAdvocate).toBe(false);
    expect(deriveDevilsFindings(c)).toHaveLength(0);
  });

  it("level 1 → empty (devil not active)", () => {
    const c = classifyTask("update file", { filesAffected: 2 });
    expect(c.level).toBe(1);
    expect(deriveDevilsFindings(c)).toHaveLength(0);
  });

  it("touchesSecurityOrAuth → blocker finding", () => {
    const c = classifyTask("fix auth", {
      filesAffected: 3,
      domainsCrossed: 2,
      touchesSecurityOrAuth: true,
    });
    expect(c.requiresDevilsAdvocate).toBe(true);
    const findings = deriveDevilsFindings(c);
    const f = findings.find((x) => x.signal === "touchesSecurityOrAuth");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("blocker");
  });

  it("isIrreversible → blocker finding", () => {
    const c = classifyTask("drop table", {
      filesAffected: 3,
      domainsCrossed: 2,
      isIrreversible: true,
    });
    const findings = deriveDevilsFindings(c);
    const f = findings.find((x) => x.signal === "isIrreversible");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("blocker");
  });

  it("touchesProduction → warning finding", () => {
    const c = classifyTask("deploy to prod", {
      filesAffected: 3,
      domainsCrossed: 2,
      touchesProduction: true,
    });
    const findings = deriveDevilsFindings(c);
    const f = findings.find((x) => x.signal === "touchesProduction");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("warning");
  });

  it("touchesPersistentData → warning finding", () => {
    const c = classifyTask("migrate schema", {
      filesAffected: 3,
      domainsCrossed: 2,
      touchesPersistentData: true,
    });
    const findings = deriveDevilsFindings(c);
    const f = findings.find((x) => x.signal === "touchesPersistentData");
    expect(f?.severity).toBe("warning");
  });

  it("generatesFinancialCost → warning finding", () => {
    const c = classifyTask("provision infra", {
      filesAffected: 3,
      domainsCrossed: 2,
      generatesFinancialCost: true,
    });
    const findings = deriveDevilsFindings(c);
    const f = findings.find((x) => x.signal === "generatesFinancialCost");
    expect(f?.severity).toBe("warning");
  });

  it("level 4 → info finding about complexity", () => {
    const c = classifyTask("overhaul", {
      filesAffected: 4,
      domainsCrossed: 2,
      requiresNewArchitecture: true,
      isIrreversible: true,
      touchesProduction: true,
    });
    expect(c.level).toBe(4);
    const findings = deriveDevilsFindings(c);
    const f = findings.find((x) => x.signal === "level");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("info");
  });

  it("multiple signals → multiple findings", () => {
    const c = classifyTask("delete prod data", {
      filesAffected: 4,
      touchesProduction: true,
      touchesSecurityOrAuth: true,
      isIrreversible: true,
    });
    const findings = deriveDevilsFindings(c);
    expect(findings.length).toBeGreaterThanOrEqual(3);
  });
});

// ── R4 — Approval ─────────────────────────────────────────────────────────────

describe("approval", () => {
  it("clean task: resolved + COMPLETED + ready → approved true, empty blockers", () => {
    const r = buildDelegationReport({
      taskId: "t1",
      prompt: "add comment",
      classification: classifyTask("add comment"),
      resolution: resolved,
      execution: completedExecution(),
    });
    expect(r.approved).toBe(true);
    expect(r.blockers).toHaveLength(0);
  });

  it("delegation blocked → approved false", () => {
    const r = buildDelegationReport({
      taskId: "t1",
      prompt: "p",
      classification: classifyTask("p"),
      resolution: blockedResolution,
    });
    expect(r.approved).toBe(false);
    expect(r.blockers.some((b) => b.includes("BLOCKED"))).toBe(true);
  });

  it("execution FAILED → approved false", () => {
    const r = buildDelegationReport({
      taskId: "t1",
      prompt: "p",
      classification: classifyTask("p"),
      resolution: resolved,
      execution: failedExecution(),
    });
    expect(r.approved).toBe(false);
    expect(r.blockers.some((b) => b.includes("FAILED"))).toBe(true);
  });

  it("execution SUBMITTED (not terminal) → approved false", () => {
    const r = buildDelegationReport({
      taskId: "t1",
      prompt: "p",
      classification: classifyTask("p"),
      resolution: resolved,
      execution: { ...completedExecution(), status: "SUBMITTED" },
    });
    expect(r.approved).toBe(false);
    expect(r.blockers.some((b) => b.includes("SUBMITTED"))).toBe(true);
  });

  it("viability needs_approval → NEEDS_APPROVAL in blockers and approved is false", () => {
    const r = buildDelegationReport({
      taskId: "t1",
      prompt: "delete prod",
      classification: classifyTask("delete prod", { touchesProduction: true }),
      resolution: resolved,
      execution: completedExecution(),
    });
    expect(r.blockers.some((b) => b.includes("NEEDS_APPROVAL"))).toBe(true);
    // needs_approval in viability → approved must be false regardless of execution status
    expect(r.approved).toBe(false);
  });

  it("no execution provided → approved based on delegation only", () => {
    const r = buildDelegationReport({
      taskId: "t1",
      prompt: "p",
      classification: classifyTask("p"),
      resolution: resolved,
    });
    expect(r.approved).toBe(true);
    expect(r.execution).toBeUndefined();
  });
});

// ── R5 — Pure function ────────────────────────────────────────────────────────

describe("pure function", () => {
  it("does not throw for trivial inputs", () => {
    expect(() => buildDelegationReport({
      taskId: "t",
      prompt: "x",
      classification: classifyTask("x"),
      resolution: resolved,
    })).not.toThrow();
  });

  it("does not throw for blocked + no execution", () => {
    expect(() => buildDelegationReport({
      taskId: "t",
      prompt: "x",
      classification: classifyTask("x"),
      resolution: blockedResolution,
    })).not.toThrow();
  });

  it("deriveDevilsFindings does not throw for any classification level", () => {
    for (const level of [0, 1, 2, 3, 4] as const) {
      const c = classifyTask("test", {
        filesAffected: level === 0 ? 1 : level <= 2 ? 3 : 4,
        domainsCrossed: level >= 2 ? 2 : 0,
        touchesProduction: level >= 3,
        isIrreversible: level >= 4,
      });
      expect(() => deriveDevilsFindings(c)).not.toThrow();
    }
  });
});
