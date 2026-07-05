import type { SupervisionPolicy } from "../../../shared/src/ports/orchestration.js";
import type { TaskAssignment } from "../../../shared/src/ports/orchestration.js";

export class DefaultSupervisionPolicy implements SupervisionPolicy {
  readonly noSelfApproval = true as const;
  requireDedicatedTester = false;
  requireDedicatedReviewer = false;
  requireIndependentReview = true;
  requireFreshContext = false;
  blockOnMissingEvidence = true;

  validate(assignment: TaskAssignment): string[] {
    const violations: string[] = [];

    if (assignment.executor.id === assignment.reviewer.id) {
      violations.push("noSelfApproval: executor and reviewer are the same agent");
    }

    if (this.requireIndependentReview && assignment.executor.id === assignment.reviewer.id) {
      violations.push("requireIndependentReview: no independent reviewer assigned");
    }

    if (!assignment.reviewer.canReview) {
      violations.push(`reviewerIncapable: agent '${assignment.reviewer.id}' does not have canReview=true`);
    }

    if (!assignment.tester.canTest) {
      violations.push(`testerIncapable: agent '${assignment.tester.id}' does not have canTest=true`);
    }

    return violations;
  }
}
