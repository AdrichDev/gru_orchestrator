import fs from "fs";
import path from "path";
import type { QualityGateResult } from "../../../shared/src/ports/results.js";
import type { ExecutionResult, ReviewResult, TestEvidence } from "../../../shared/src/ports/results.js";
import type { TaskAssignment } from "../../../shared/src/ports/orchestration.js";

export function evaluateSpecCompliance(
  _assignment: TaskAssignment,
  result: ExecutionResult
): QualityGateResult {
  if (!result.success || result.output.trim().length === 0) {
    return {
      gate: "spec-compliance",
      status: "failed",
      reason: "Execution failed or produced empty output",
    };
  }
  return { gate: "spec-compliance", status: "passed" };
}

export function evaluateImplementationIntegrity(
  evidence: TestEvidence | undefined
): QualityGateResult {
  if (!evidence) {
    return {
      gate: "code-regression",
      status: "blocked",
      reason: "No test evidence provided",
    };
  }
  if (!evidence.passed || evidence.regressions.length > 0) {
    return {
      gate: "code-regression",
      status: "failed",
      reason: `Regressions: ${evidence.regressions.join(", ") || "tests failed"}`,
    };
  }
  return { gate: "code-regression", status: "passed" };
}

export function evaluateReviewIndependence(
  assignment: TaskAssignment,
  review: ReviewResult
): QualityGateResult {
  const sameAgent =
    assignment.executor.id === assignment.reviewer.id ||
    assignment.executor.id === review.reviewer.id;
  if (sameAgent) {
    return {
      gate: "review-independence",
      status: "failed",
      reason: "Executor and reviewer are the same agent — self-approval not allowed",
    };
  }
  return { gate: "review-independence", status: "passed" };
}

export function evaluateTestEvidence(
  evidence: TestEvidence | undefined
): QualityGateResult {
  if (!evidence) {
    return {
      gate: "test-evidence",
      status: "blocked",
      reason: "TestEvidence absent — tester did not produce output",
    };
  }
  if (!evidence.passed) {
    return {
      gate: "test-evidence",
      status: "failed",
      reason: `${evidence.regressions.length} regression(s) detected`,
    };
  }
  return { gate: "test-evidence", status: "passed" };
}

export function evaluateSecurityAndSafety(review: ReviewResult): QualityGateResult {
  const blockers = review.findings.filter(
    (f) => f.severity === "blocker" && f.fixRequired
  );
  if (blockers.length > 0) {
    return {
      gate: "security",
      status: "failed",
      reason: `${blockers.length} security blocker(s): ${blockers.map((f) => f.message).join("; ")}`,
      evidence: blockers.map((f) => f.location ?? f.message),
    };
  }
  return { gate: "security", status: "passed" };
}

// T-3 FIX (P-02 path confinement): validate sddId before resolving to a
// filesystem path. Reject any value containing path separators, "..", or an
// absolute path component. Then confirm the resolved path stays under the
// expected base directory; if it escapes, fail the gate (fail-closed).
const SDD_ID_SAFE = /^[a-zA-Z0-9_\-]+$/;

export function evaluateSddTraceability(sddId: string): QualityGateResult {
  // 1. Reject unsafe sddId values before touching the filesystem.
  if (!sddId || !SDD_ID_SAFE.test(sddId)) {
    return {
      gate: "sdd-traceability",
      status: "failed",
      reason: `Invalid sddId — must be alphanumeric/dash/underscore only: ${JSON.stringify(sddId)}`,
    };
  }

  const base = path.resolve("openspec", "changes");
  const sddDir = path.resolve(base, sddId);

  // 2. Confirm resolved path stays inside the base directory.
  const rel = path.relative(base, sddDir);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return {
      gate: "sdd-traceability",
      status: "failed",
      reason: `Path traversal detected for sddId: ${JSON.stringify(sddId)}`,
    };
  }

  const required = ["proposal.md", "spec.md", "design.md", "tasks.md"];
  const missing = required.filter((f) => !fs.existsSync(path.join(sddDir, f)));
  if (missing.length > 0) {
    return {
      gate: "sdd-traceability",
      status: "failed",
      reason: `Missing SDD artifacts: ${missing.join(", ")}`,
      evidence: [sddDir],
    };
  }
  return { gate: "sdd-traceability", status: "passed" };
}

export function evaluateAllGates(
  assignment: TaskAssignment,
  executionResult: ExecutionResult,
  reviewResult: ReviewResult,
  testEvidence: TestEvidence | undefined,
  sddId: string
): QualityGateResult[] {
  return [
    evaluateSpecCompliance(assignment, executionResult),
    evaluateImplementationIntegrity(testEvidence),
    evaluateReviewIndependence(assignment, reviewResult),
    evaluateTestEvidence(testEvidence),
    evaluateSecurityAndSafety(reviewResult),
    evaluateSddTraceability(sddId),
  ];
}
