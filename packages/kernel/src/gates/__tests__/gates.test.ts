import { describe, it, expect } from "vitest";
import {
  evaluateSpecCompliance,
  evaluateImplementationIntegrity,
  evaluateReviewIndependence,
  evaluateTestEvidence,
  evaluateSecurityAndSafety,
  evaluateSddTraceability,
} from "../index.js";
import type { TaskAssignment } from "../../../../shared/src/ports/orchestration.js";
import type {
  ExecutionResult,
  ReviewResult,
  TestEvidence,
} from "../../../../shared/src/ports/results.js";
import type { AgentDescriptor } from "../../../../shared/src/ports/agent.js";

function agent(id: string): AgentDescriptor {
  return {
    id, provider: "ruflo", sourcePath: "/x", name: id, description: "",
    capabilities: [], supportedPhases: [], tools: [], skills: [],
    executionMode: "write", riskLevel: 2, canWrite: true, canReview: false,
    canTest: false, availability: "available",
  };
}

function assignment(execId: string, reviewerId: string): TaskAssignment {
  return {
    id: "a1", task: { id: "t1", prompt: "test" }, phase: "apply",
    executor: agent(execId), reviewer: agent(reviewerId), tester: agent("agent-tester"),
    scope: [], gates: [],
  };
}

function execResult(success: boolean, output = "done"): ExecutionResult {
  return {
    assignmentId: "a1", agent: agent("agent-coder"), phase: "apply",
    success, output, affectedFiles: [], artifacts: [],
    startedAt: "", finishedAt: "",
  };
}

function reviewResult(approved: boolean, findings: any[] = []): ReviewResult {
  return {
    assignmentId: "a1", reviewer: agent("agent-reviewer"),
    approved, findings, blockers: [], suggestions: [],
    completedAt: "",
  };
}

function testEvidence(passed: boolean, regressions: string[] = []): TestEvidence {
  return {
    assignmentId: "a1", tester: agent("agent-validator"),
    passed, suites: [], regressions, completedAt: "",
  };
}

describe("evaluateSpecCompliance", () => {
  it("passes when execution succeeded with output", () => {
    const r = evaluateSpecCompliance(assignment("a", "b"), execResult(true, "output here"));
    expect(r.status).toBe("passed");
  });

  it("fails when execution failed", () => {
    const r = evaluateSpecCompliance(assignment("a", "b"), execResult(false));
    expect(r.status).toBe("failed");
  });

  it("fails when output is empty", () => {
    const r = evaluateSpecCompliance(assignment("a", "b"), execResult(true, "  "));
    expect(r.status).toBe("failed");
  });
});

describe("evaluateImplementationIntegrity", () => {
  it("blocked when no evidence", () => {
    const r = evaluateImplementationIntegrity(undefined);
    expect(r.status).toBe("blocked");
  });

  it("passes with no regressions", () => {
    const r = evaluateImplementationIntegrity(testEvidence(true, []));
    expect(r.status).toBe("passed");
  });

  it("fails with regressions", () => {
    const r = evaluateImplementationIntegrity(testEvidence(false, ["AuthTest"]));
    expect(r.status).toBe("failed");
    expect(r.reason).toContain("AuthTest");
  });
});

describe("evaluateReviewIndependence", () => {
  it("passes when executor !== reviewer", () => {
    const r = evaluateReviewIndependence(assignment("agent-coder", "agent-reviewer"), reviewResult(true));
    expect(r.status).toBe("passed");
  });

  it("fails when executor === reviewer in assignment", () => {
    const r = evaluateReviewIndependence(assignment("agent-coder", "agent-coder"), reviewResult(true));
    expect(r.status).toBe("failed");
  });
});

describe("evaluateTestEvidence", () => {
  it("blocked when undefined", () => {
    expect(evaluateTestEvidence(undefined).status).toBe("blocked");
  });

  it("passes when tests passed", () => {
    expect(evaluateTestEvidence(testEvidence(true)).status).toBe("passed");
  });

  it("fails when tests failed", () => {
    expect(evaluateTestEvidence(testEvidence(false, ["X"])).status).toBe("failed");
  });
});

describe("evaluateSecurityAndSafety", () => {
  it("passes with no blocker findings", () => {
    const r = evaluateSecurityAndSafety(reviewResult(true, []));
    expect(r.status).toBe("passed");
  });

  it("fails with blocker finding requiring fix", () => {
    const findings = [{ severity: "blocker" as const, message: "SQL injection", fixRequired: true }];
    const r = evaluateSecurityAndSafety(reviewResult(false, findings));
    expect(r.status).toBe("failed");
    expect(r.reason).toContain("SQL injection");
  });

  it("passes with blocker finding not requiring fix", () => {
    const findings = [{ severity: "blocker" as const, message: "note", fixRequired: false }];
    const r = evaluateSecurityAndSafety(reviewResult(true, findings));
    expect(r.status).toBe("passed");
  });
});

describe("evaluateSddTraceability", () => {
  it("fails when sdd dir does not exist", () => {
    const r = evaluateSddTraceability("nonexistent-sdd-id-xyz");
    expect(r.status).toBe("failed");
    expect(r.reason).toContain("proposal.md");
  });

  it("passes when all four artifacts exist", () => {
    // gru-agentic-provider-orchestration has all four files
    const r = evaluateSddTraceability("gru-agentic-provider-orchestration");
    expect(r.status).toBe("passed");
  });

  // T-3 regression: path traversal inputs must be rejected fail-closed.
  it("fails (fail-closed) on path traversal sddId with ..", () => {
    const r = evaluateSddTraceability("../../..");
    expect(r.status).toBe("failed");
    expect(r.reason).toContain("Invalid sddId");
  });

  it("fails (fail-closed) on sddId with forward slash", () => {
    const r = evaluateSddTraceability("valid/../../etc/passwd");
    expect(r.status).toBe("failed");
    expect(r.reason).toContain("Invalid sddId");
  });

  it("fails (fail-closed) on sddId with backslash", () => {
    const r = evaluateSddTraceability("valid\\..\\secret");
    expect(r.status).toBe("failed");
    expect(r.reason).toContain("Invalid sddId");
  });

  it("fails (fail-closed) on empty sddId", () => {
    const r = evaluateSddTraceability("");
    expect(r.status).toBe("failed");
    expect(r.reason).toContain("Invalid sddId");
  });
});
