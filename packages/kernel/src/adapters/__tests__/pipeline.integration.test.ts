import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { DefaultAgentResolver } from "../resolver.js";
import { DefaultSupervisionPolicy } from "../supervision.js";
import { DefaultProviderRegistry } from "../registry-agentic.js";
import { RufloAgentCatalog } from "../ruflo.js";
import { evaluateAllGates } from "../../gates/index.js";
import type {
  ProviderAdapter,
  ProviderAdapterStatus,
  TaskAssignment,
} from "../../../../shared/src/ports/orchestration.js";
import type { AgentCatalog } from "../../../../shared/src/ports/agent.js";
import type {
  ExecutionResult,
  ReviewResult,
  TestEvidence,
  TestSuiteResult,
} from "../../../../shared/src/ports/results.js";
import type { ProviderId } from "../../../../shared/src/ports/provider.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures");
const MOCK_BASE = path.join(__dirname, "mock-ruflo");

function setupMockRuflo(): string {
  const skillsDir = path.join(MOCK_BASE, ".agents", "skills");
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
    for (const name of [
      "agent-coder",
      "agent-reviewer",
      "agent-production-validator",
      "context-skill-only",
    ]) {
      const src = path.join(FIXTURES, name, "SKILL.md");
      const dest = path.join(skillsDir, name);
      fs.mkdirSync(dest, { recursive: true });
      fs.copyFileSync(src, path.join(dest, "SKILL.md"));
    }
  }
  return MOCK_BASE;
}

// Stub adapter: real catalog from fixtures, controlled execute() — no CLI calls.
class StubRufloAdapter implements ProviderAdapter {
  readonly id: ProviderId = "ruflo";
  private readonly catalog: RufloAgentCatalog;

  constructor(basePath: string) {
    this.catalog = new RufloAgentCatalog(basePath);
  }

  async checkAvailability(): Promise<ProviderAdapterStatus> {
    return { status: "available", agentCount: 3 };
  }

  getCatalog(): AgentCatalog {
    return this.catalog;
  }

  async execute(assignment: TaskAssignment): Promise<ExecutionResult> {
    const role = (assignment.task.metadata?.role as string) ?? "executor";
    const agent =
      role === "reviewer"
        ? assignment.reviewer
        : role === "tester"
          ? assignment.tester
          : assignment.executor;
    return {
      assignmentId: assignment.id,
      agent,
      phase: assignment.phase,
      success: true,
      output: `[stub:${role}] Task accepted: ${assignment.task.prompt}`,
      affectedFiles: [],
      artifacts: [],
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    };
  }
}

describe("agentic pipeline — full integration", () => {
  let mockBase: string;

  beforeAll(() => {
    mockBase = setupMockRuflo();
  });

  it("executor → independent reviewer → tester → 6 gates → PlanResult approved", async () => {
    const policy = new DefaultSupervisionPolicy();
    const registry = new DefaultProviderRegistry();
    const stubAdapter = new StubRufloAdapter(mockBase);
    registry.register(stubAdapter);

    const resolver = new DefaultAgentResolver(registry, policy);
    const task = { id: "integ-001", prompt: "Implement feature X per spec", metadata: {} };

    // ── Step 1: resolve assignment ────────────────────────────────────────────
    const assignment = await resolver.resolve(task, "apply");

    expect(assignment.executor.provider).toBe("ruflo");
    expect(assignment.reviewer.provider).toBe("ruflo");
    expect(assignment.tester.provider).toBe("ruflo");
    expect(assignment.executor.id).not.toBe(assignment.reviewer.id);
    expect(assignment.executor.canWrite).toBe(true);
    expect(assignment.reviewer.canReview).toBe(true);
    expect(assignment.tester.canTest).toBe(true);

    // ── Step 2: executor ──────────────────────────────────────────────────────
    const executionResult = await stubAdapter.execute({
      ...assignment,
      task: { ...task, metadata: { role: "executor" } },
    });
    expect(executionResult.success).toBe(true);
    expect(executionResult.output.length).toBeGreaterThan(0);

    // ── Step 3: reviewer (independent from executor) ──────────────────────────
    const reviewerExecResult = await stubAdapter.execute({
      ...assignment,
      task: { ...task, metadata: { role: "reviewer", previousOutput: executionResult.output } },
    });
    expect(reviewerExecResult.success).toBe(true);

    const reviewResult: ReviewResult = {
      assignmentId: assignment.id,
      reviewer: assignment.reviewer,
      approved: true,
      findings: [],
      blockers: [],
      suggestions: [],
      completedAt: new Date().toISOString(),
    };

    // ── Step 4: tester ────────────────────────────────────────────────────────
    const testerExecResult = await stubAdapter.execute({
      ...assignment,
      task: { ...task, metadata: { role: "tester", previousOutput: executionResult.output } },
    });
    expect(testerExecResult.success).toBe(true);

    const testEvidence: TestEvidence = {
      assignmentId: assignment.id,
      tester: assignment.tester,
      passed: true,
      suites: [
        { name: "unit", passed: 8, failed: 0, skipped: 0, duration: 120 },
        { name: "integration", passed: 3, failed: 0, skipped: 0, duration: 350 },
      ] as TestSuiteResult[],
      regressions: [],
      completedAt: new Date().toISOString(),
    };

    // ── Step 5: evaluate all 6 gates ──────────────────────────────────────────
    const sddId = "gru-agentic-provider-orchestration";
    const gates = evaluateAllGates(assignment, executionResult, reviewResult, testEvidence, sddId);

    expect(gates).toHaveLength(6);
    const gateMap = Object.fromEntries(gates.map((g) => [g.gate, g.status]));

    expect(gateMap["spec-compliance"]).toBe("passed");
    expect(gateMap["code-regression"]).toBe("passed");
    expect(gateMap["review-independence"]).toBe("passed");
    expect(gateMap["test-evidence"]).toBe("passed");
    expect(gateMap["security"]).toBe("passed");
    expect(gateMap["sdd-traceability"]).toBe("passed");

    // ── Step 6: build PlanResult ──────────────────────────────────────────────
    const failedRequired = gates.filter((g) => {
      const gate = assignment.gates.find((ag) => ag.id === g.gate);
      return gate?.required && (g.status === "failed" || g.status === "blocked");
    });

    const planResult = {
      plan: {
        id: task.id,
        description: task.prompt,
        assignments: [assignment],
        gates: assignment.gates,
        createdAt: new Date().toISOString(),
      },
      executionResults: [executionResult],
      reviewResults: [reviewResult],
      testEvidences: [testEvidence],
      gateResults: gates,
      approved: failedRequired.length === 0,
      blockers: failedRequired.map((g) => `${g.gate}: ${g.reason ?? g.status}`),
    };

    expect(planResult.approved).toBe(true);
    expect(planResult.blockers).toHaveLength(0);
    expect(planResult.executionResults[0].success).toBe(true);
    expect(planResult.reviewResults[0].approved).toBe(true);
    expect(planResult.testEvidences[0].passed).toBe(true);
  });

  it("blocks when reviewer is same as executor", async () => {
    // Verify noSelfApproval gate fires correctly
    const policy = new DefaultSupervisionPolicy();
    const registry = new DefaultProviderRegistry();
    registry.register(new StubRufloAdapter(mockBase));
    const resolver = new DefaultAgentResolver(registry, policy);

    const task = { id: "integ-002", prompt: "Self-review attempt", metadata: {} };
    const assignment = await resolver.resolve(task, "apply");

    // Construct a tampered assignment where executor === reviewer
    const tampered: TaskAssignment = {
      ...assignment,
      reviewer: { ...assignment.executor },
    };

    const executionResult: ExecutionResult = {
      assignmentId: tampered.id,
      agent: tampered.executor,
      phase: tampered.phase,
      success: true,
      output: "some output",
      affectedFiles: [],
      artifacts: [],
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    };

    const reviewResult: ReviewResult = {
      assignmentId: tampered.id,
      reviewer: tampered.reviewer,
      approved: true,
      findings: [],
      blockers: [],
      suggestions: [],
      completedAt: new Date().toISOString(),
    };

    const testEvidence: TestEvidence = {
      assignmentId: tampered.id,
      tester: tampered.tester,
      passed: true,
      suites: [{ name: "unit", passed: 5, failed: 0, skipped: 0, duration: 80 }] as TestSuiteResult[],
      regressions: [],
      completedAt: new Date().toISOString(),
    };

    const gates = evaluateAllGates(
      tampered,
      executionResult,
      reviewResult,
      testEvidence,
      "gru-agentic-provider-orchestration"
    );

    const independenceGate = gates.find((g) => g.gate === "review-independence");
    expect(independenceGate?.status).toBe("failed");
  });

  it("SUBMITTED/TIMEOUT execution result cannot pass gates or produce APPROVED", async () => {
    const policy = new DefaultSupervisionPolicy();
    const registry = new DefaultProviderRegistry();
    registry.register(new StubRufloAdapter(mockBase));
    const resolver = new DefaultAgentResolver(registry, policy);

    const task = { id: "integ-003", prompt: "Async delegation probe", metadata: {} };
    const assignment = await resolver.resolve(task, "apply");

    // Simulate what happens when Ruflo daemon is stopped:
    // workflow submitted but never completed → success=false, output=[TIMEOUT]
    const submittedResult: ExecutionResult = {
      assignmentId: assignment.id,
      agent: assignment.executor,
      phase: assignment.phase,
      success: false,
      output: "[TIMEOUT] workflow:workflow-xxx-000 — Workflow did not reach terminal state within 60000ms. Daemon may not be running.",
      affectedFiles: [],
      artifacts: ["ruflo:workflow:workflow-xxx-000:timeout"],
      error: { code: "TIMEOUT", message: "Daemon not running", recoverable: true },
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    };

    // Blocked review — reviewer was never invoked because execution did not complete
    const blockedReview: ReviewResult = {
      assignmentId: assignment.id,
      reviewer: assignment.reviewer,
      approved: false,
      findings: [],
      blockers: ["Execution did not complete — review blocked"],
      suggestions: [],
      completedAt: new Date().toISOString(),
    };

    // No test evidence — tester was never invoked
    const gates = evaluateAllGates(
      assignment,
      submittedResult,
      blockedReview,
      undefined, // no testEvidence
      "gru-agentic-provider-orchestration"
    );

    const gateMap = Object.fromEntries(gates.map((g) => [g.gate, g.status]));

    // Execution failed → spec-compliance must fail
    expect(gateMap["spec-compliance"]).toBe("failed");
    // No test evidence → code-regression and test-evidence must block
    expect(gateMap["code-regression"]).toBe("blocked");
    expect(gateMap["test-evidence"]).toBe("blocked");

    // Build final result — mirroring orchestrateAgenticTask early-return on !success
    const failedRequired = gates.filter((g) => {
      const gate = assignment.gates.find((ag) => ag.id === g.gate);
      return gate?.required && (g.status === "failed" || g.status === "blocked");
    });

    expect(failedRequired.length).toBeGreaterThan(0);

    const planResult = {
      approved: failedRequired.length === 0,
      blockers: failedRequired.map((g) => `${g.gate}: ${g.reason ?? g.status}`),
      gateResults: gates,
    };

    expect(planResult.approved).toBe(false);
    expect(planResult.blockers.length).toBeGreaterThan(0);
  });
});
