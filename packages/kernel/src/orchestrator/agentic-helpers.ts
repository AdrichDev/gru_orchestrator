import type { TaskAssignment } from "../../../shared/src/ports/orchestration.js";
import type { ReviewResult, TestEvidence } from "../../../shared/src/ports/results.js";

export function buildReviewResultFromOutput(
  assignment: TaskAssignment,
  output: string,
  success: boolean
): ReviewResult {
  const approved = success && !/(BLOCKER|FAIL|REJECT|ERROR)/i.test(output);
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
  const passed = success && !/(FAIL|ERROR|REGRESSION)/i.test(output);
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
