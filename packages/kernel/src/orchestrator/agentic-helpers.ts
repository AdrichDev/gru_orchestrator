import type { TaskAssignment } from "../../../shared/src/ports/orchestration.js";
import type { ReviewResult, TestEvidence } from "../../../shared/src/ports/results.js";

// T-7 FIX (fail-closed positive verdict): approval requires an explicit
// positive marker from the sub-agent, not merely the absence of bad words.
// Pattern: output must contain a line starting with "VERDICT: APPROVED" or
// "VERDICT: PASS" (case-insensitive), AND must not contain hard blockers,
// AND success must be true. Any of those absent → approved=false.
const REVIEW_POSITIVE_VERDICT = /^VERDICT:\s*(APPROVED|PASS)\b/im;
const REVIEW_HARD_BLOCKERS = /(BLOCKER|FAIL|REJECT|ERROR)/i;

const TESTS_POSITIVE_VERDICT = /^TESTS:\s*PASS\b/im;
const TESTS_HARD_BLOCKERS = /(FAIL|ERROR|REGRESSION)/i;

export function buildReviewResultFromOutput(
  assignment: TaskAssignment,
  output: string,
  success: boolean
): ReviewResult {
  // Fail-closed: require explicit positive verdict AND absence of blockers.
  const approved =
    success &&
    REVIEW_POSITIVE_VERDICT.test(output) &&
    !REVIEW_HARD_BLOCKERS.test(output);
  const blockers = approved ? [] : ["Review did not approve — see output"];
  return {
    assignmentId: assignment.id,
    reviewer: assignment.reviewer,
    approved,
    findings: [],
    blockers,
    suggestions: [],
    completedAt: new Date().toISOString(),
  };
}

export function buildTestEvidenceFromOutput(
  assignment: TaskAssignment,
  output: string,
  success: boolean
): TestEvidence {
  // Fail-closed: require explicit positive verdict AND absence of blockers.
  const passed =
    success &&
    TESTS_POSITIVE_VERDICT.test(output) &&
    !TESTS_HARD_BLOCKERS.test(output);
  return {
    assignmentId: assignment.id,
    tester: assignment.tester,
    passed,
    suites: [],
    regressions: passed ? [] : ["Tester reported failure — see output"],
    completedAt: new Date().toISOString(),
  };
}

export function parseWorkflowState(result: { artifacts?: string[] }): string {
  const tag = (result.artifacts ?? []).find((a) => a.startsWith("ruflo:workflow:"));
  return tag ? (tag.split(":")[3] ?? "unknown") : "unknown";
}

export function makeBlockedReview(assignment: TaskAssignment): ReviewResult {
  return {
    assignmentId: assignment.id,
    reviewer: assignment.reviewer,
    approved: false,
    findings: [],
    blockers: ["Execution did not complete — review blocked"],
    suggestions: [],
    completedAt: new Date().toISOString(),
  };
}
