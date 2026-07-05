import { describe, it, expect } from "vitest";
import { DefaultSupervisionPolicy } from "../supervision.js";
import type { TaskAssignment } from "../../../../shared/src/ports/orchestration.js";
import type { AgentDescriptor } from "../../../../shared/src/ports/agent.js";

function makeAgent(overrides: Partial<AgentDescriptor>): AgentDescriptor {
  return {
    id: "agent-default",
    provider: "local",
    sourcePath: "/fake/SKILL.md",
    name: "Default",
    description: "",
    capabilities: [],
    supportedPhases: ["apply"],
    tools: [],
    skills: [],
    executionMode: "write",
    riskLevel: 2,
    canWrite: false,
    canReview: false,
    canTest: false,
    availability: "available",
    ...overrides,
  };
}

function makeAssignment(
  executor: AgentDescriptor,
  reviewer: AgentDescriptor,
  tester: AgentDescriptor
): TaskAssignment {
  return {
    id: "test-assign",
    task: { id: "t1", prompt: "test" },
    phase: "apply",
    executor,
    reviewer,
    tester,
    scope: [],
    gates: [],
  };
}

describe("DefaultSupervisionPolicy.validate", () => {
  const policy = new DefaultSupervisionPolicy();

  it("returns no violations for valid assignment", () => {
    const executor = makeAgent({ id: "agent-coder", canWrite: true });
    const reviewer = makeAgent({ id: "agent-reviewer", canReview: true });
    const tester = makeAgent({ id: "agent-validator", canTest: true });
    const violations = policy.validate(makeAssignment(executor, reviewer, tester));
    expect(violations).toHaveLength(0);
  });

  it("flags noSelfApproval when executor === reviewer", () => {
    const same = makeAgent({ id: "agent-coder", canWrite: true, canReview: true });
    const tester = makeAgent({ id: "agent-validator", canTest: true });
    const violations = policy.validate(makeAssignment(same, same, tester));
    expect(violations.some((v) => v.includes("noSelfApproval"))).toBe(true);
  });

  it("flags reviewerIncapable when canReview=false", () => {
    const executor = makeAgent({ id: "agent-coder", canWrite: true });
    const reviewer = makeAgent({ id: "agent-planner", canReview: false });
    const tester = makeAgent({ id: "agent-validator", canTest: true });
    const violations = policy.validate(makeAssignment(executor, reviewer, tester));
    expect(violations.some((v) => v.includes("reviewerIncapable"))).toBe(true);
  });

  it("flags testerIncapable when canTest=false", () => {
    const executor = makeAgent({ id: "agent-coder", canWrite: true });
    const reviewer = makeAgent({ id: "agent-reviewer", canReview: true });
    const tester = makeAgent({ id: "agent-planner", canTest: false });
    const violations = policy.validate(makeAssignment(executor, reviewer, tester));
    expect(violations.some((v) => v.includes("testerIncapable"))).toBe(true);
  });
});
