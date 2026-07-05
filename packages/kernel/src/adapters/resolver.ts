import type {
  AgentResolver,
  ProviderRegistry,
  SupervisionPolicy,
  TaskAssignment,
  QualityGate,
} from "../../../shared/src/ports/orchestration.js";
import type { AgentDescriptor, SddPhase } from "../../../shared/src/ports/agent.js";
import type { GruTask } from "../../../shared/src/ports/harness.js";

const DEFAULT_GATES: QualityGate[] = [
  { id: "spec-compliance",    required: true,  description: "Output matches spec expectations" },
  { id: "code-regression",    required: true,  description: "No test regressions introduced" },
  { id: "review-independence",required: true,  description: "Reviewer is independent from executor" },
  { id: "test-evidence",      required: true,  description: "Test evidence produced by tester" },
  { id: "security",           required: true,  description: "No security blockers in review" },
  { id: "sdd-traceability",   required: false, description: "SDD artifacts present" },
];

function selectExecutor(candidates: AgentDescriptor[], phase: SddPhase): AgentDescriptor | undefined {
  // For apply phase: prefer canWrite=true. For verify: prefer canReview/canTest.
  // General: pick highest riskLevel (most capable) that matches.
  const eligible = candidates
    .filter((a) => a.availability === "available" && a.supportedPhases.includes(phase))
    .sort((a, b) => b.riskLevel - a.riskLevel);

  if (phase === "apply") return eligible.find((a) => a.canWrite) ?? eligible[0];
  if (phase === "verify") return eligible.find((a) => a.canTest || a.canReview) ?? eligible[0];
  return eligible[0];
}

function selectReviewer(
  candidates: AgentDescriptor[],
  excludeId: string,
  policy: SupervisionPolicy
): AgentDescriptor | undefined {
  return candidates
    .filter((a) => {
      if (a.availability !== "available") return false;
      if (a.id === excludeId) return false;
      if (!a.canReview) return false;
      return true;
    })
    .sort((a, b) => b.riskLevel - a.riskLevel)[0];
}

function selectTester(
  candidates: AgentDescriptor[],
  excludeId: string,
  policy: SupervisionPolicy
): AgentDescriptor | undefined {
  return candidates
    .filter((a) => {
      if (a.availability !== "available") return false;
      if (a.id === excludeId) return false;
      if (!a.canTest) return false;
      return true;
    })
    .sort((a, b) => b.riskLevel - a.riskLevel)[0];
}

export class DefaultAgentResolver implements AgentResolver {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly policy: SupervisionPolicy
  ) {}

  async resolve(task: GruTask, phase: SddPhase): Promise<TaskAssignment> {
    const available = await this.registry.getAvailable();

    if (available.length === 0) {
      throw Object.assign(
        new Error("CAPABILITY_UNSUPPORTED: No provider adapters available"),
        { code: "CAPABILITY_UNSUPPORTED", recoverable: false }
      );
    }

    // Collect all agents from all available providers
    const allAgents: AgentDescriptor[] = (
      await Promise.all(available.map((p) => p.getCatalog().listAgents()))
    ).flat();

    const executor = selectExecutor(allAgents, phase);
    if (!executor) {
      throw Object.assign(
        new Error(`CAPABILITY_UNSUPPORTED: No executor available for phase '${phase}'`),
        { code: "CAPABILITY_UNSUPPORTED", recoverable: false }
      );
    }

    const reviewer = selectReviewer(allAgents, executor.id, this.policy);
    if (!reviewer) {
      throw Object.assign(
        new Error(
          `CAPABILITY_UNSUPPORTED: No independent reviewer available (executor: ${executor.id})`
        ),
        { code: "CAPABILITY_UNSUPPORTED", recoverable: false }
      );
    }

    const tester = selectTester(allAgents, executor.id, this.policy);
    if (this.policy.requireDedicatedTester && !tester) {
      throw Object.assign(
        new Error("CAPABILITY_UNSUPPORTED: No tester available — gate BLOCKED"),
        { code: "CAPABILITY_UNSUPPORTED", recoverable: false }
      );
    }

    const assignment: TaskAssignment = {
      id: `assign_${Date.now()}_${task.id}`,
      task,
      phase,
      executor,
      reviewer,
      tester: tester!,
      scope: [],
      gates: DEFAULT_GATES,
    };

    const violations = this.policy.validate(assignment);
    if (violations.length > 0) {
      throw Object.assign(
        new Error(`SUPERVISION_VIOLATION: ${violations.join("; ")}`),
        { code: "SUPERVISION_VIOLATION", recoverable: false }
      );
    }

    return assignment;
  }
}
