import { describe, it, expect } from "vitest";
import {
  buildReviewResultFromOutput,
  buildTestEvidenceFromOutput,
} from "../agentic-helpers.js";
import type { TaskAssignment } from "../../../../shared/src/ports/orchestration.js";
import type { AgentDescriptor } from "../../../../shared/src/ports/agent.js";

function agent(id: string): AgentDescriptor {
  return {
    id, provider: "local", sourcePath: "/x", name: id, description: "",
    capabilities: [], supportedPhases: [], tools: [], skills: [],
    executionMode: "write", riskLevel: 2, canWrite: true, canReview: false,
    canTest: false, availability: "available",
  };
}

function assignment(): TaskAssignment {
  return {
    id: "a1", task: { id: "t1", prompt: "test" }, phase: "apply",
    executor: agent("agent-coder"), reviewer: agent("agent-reviewer"),
    tester: agent("agent-tester"), scope: [], gates: [],
  };
}

// ---------------------------------------------------------------------------
// T-7 regression: buildReviewResultFromOutput — fail-closed positive verdict
// ---------------------------------------------------------------------------
describe("buildReviewResultFromOutput (T-7 fail-closed)", () => {
  it("approved=false when output has no explicit VERDICT marker (benign text)", () => {
    // Red team payload: no bad words, but also no positive verdict → must NOT approve
    const result = buildReviewResultFromOutput(assignment(), "All looks good, code is fine.", true);
    expect(result.approved).toBe(false);
  });

  it("approved=false when success=false even with VERDICT: APPROVED", () => {
    const result = buildReviewResultFromOutput(assignment(), "VERDICT: APPROVED", false);
    expect(result.approved).toBe(false);
  });

  it("approved=true only with VERDICT: APPROVED, no blockers, success=true", () => {
    const result = buildReviewResultFromOutput(assignment(), "Review complete.\nVERDICT: APPROVED\nAll good.", true);
    expect(result.approved).toBe(true);
  });

  it("approved=true with VERDICT: PASS", () => {
    const result = buildReviewResultFromOutput(assignment(), "VERDICT: PASS", true);
    expect(result.approved).toBe(true);
  });

  it("approved=false when VERDICT: APPROVED but ERROR also present", () => {
    const result = buildReviewResultFromOutput(assignment(), "VERDICT: APPROVED\nERROR: something went wrong", true);
    expect(result.approved).toBe(false);
  });

  it("approved=false when VERDICT: APPROVED but BLOCKER present", () => {
    const result = buildReviewResultFromOutput(assignment(), "VERDICT: APPROVED\nBLOCKER: critical issue", true);
    expect(result.approved).toBe(false);
  });

  it("approved=false on empty output", () => {
    const result = buildReviewResultFromOutput(assignment(), "", true);
    expect(result.approved).toBe(false);
  });

  it("approved=false on output with only whitespace", () => {
    const result = buildReviewResultFromOutput(assignment(), "   \n   ", true);
    expect(result.approved).toBe(false);
  });

  it("VERDICT is case-insensitive", () => {
    const result = buildReviewResultFromOutput(assignment(), "verdict: approved", true);
    expect(result.approved).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T-7 regression: buildTestEvidenceFromOutput — fail-closed positive verdict
// ---------------------------------------------------------------------------
describe("buildTestEvidenceFromOutput (T-7 fail-closed)", () => {
  it("passed=false when output has no TESTS: PASS marker (benign text)", () => {
    // Red team payload: no failure words, but no explicit pass verdict → must NOT pass
    const result = buildTestEvidenceFromOutput(assignment(), "All suites ran, no issues found.", true);
    expect(result.passed).toBe(false);
  });

  it("passed=false when success=false even with TESTS: PASS", () => {
    const result = buildTestEvidenceFromOutput(assignment(), "TESTS: PASS", false);
    expect(result.passed).toBe(false);
  });

  it("passed=true only with TESTS: PASS, no blockers, success=true", () => {
    const result = buildTestEvidenceFromOutput(assignment(), "Suite done.\nTESTS: PASS\n3 suites.", true);
    expect(result.passed).toBe(true);
  });

  it("passed=false when TESTS: PASS but FAIL also present", () => {
    const result = buildTestEvidenceFromOutput(assignment(), "TESTS: PASS\nFAIL: auth.test.ts", true);
    expect(result.passed).toBe(false);
  });

  it("passed=false when TESTS: PASS but REGRESSION also present", () => {
    const result = buildTestEvidenceFromOutput(assignment(), "TESTS: PASS\nREGRESSION: found 1", true);
    expect(result.passed).toBe(false);
  });

  it("passed=false on empty output", () => {
    const result = buildTestEvidenceFromOutput(assignment(), "", true);
    expect(result.passed).toBe(false);
  });

  it("TESTS marker is case-insensitive", () => {
    const result = buildTestEvidenceFromOutput(assignment(), "tests: pass", true);
    expect(result.passed).toBe(true);
  });
});
