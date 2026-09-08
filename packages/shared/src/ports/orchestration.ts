import type { ProviderId } from "./provider.js";
import type { GruTask } from "./harness.js";
import type { AgentDescriptor, AgentCatalog, SddPhase } from "./agent.js";
import type { ExecutionResult, ReviewResult, TestEvidence, QualityGateResult, QualityGateId } from "./results.js";

export type ProviderAdapterStatusCode = "available" | "unavailable" | "unsupported";

export interface ProviderAdapterStatus {
  status: ProviderAdapterStatusCode;
  reason?: string;
  agentCount?: number;
  version?: string;
}

/** High-level adapter for an agent/capability provider (Gentleman, AwesomeCopilot). */
export interface ProviderAdapter {
  readonly id: ProviderId;
  checkAvailability(): Promise<ProviderAdapterStatus>;
  getCatalog(): AgentCatalog;
  execute(assignment: TaskAssignment): Promise<ExecutionResult>;
}

export interface ProviderRegistry {
  register(adapter: ProviderAdapter): void;
  get(id: ProviderId): ProviderAdapter | undefined;
  getAvailable(): Promise<ProviderAdapter[]>;
  list(): ProviderAdapter[];
}

export interface QualityGate {
  id: QualityGateId;
  required: boolean;
  description: string;
}

export interface TaskAssignment {
  id: string;
  task: GruTask;
  phase: SddPhase;
  executor: AgentDescriptor;
  reviewer: AgentDescriptor;    // must differ from executor (no self-approval)
  tester: AgentDescriptor;      // dedicated tester mandatory if available; else BLOCKED
  scope: string[];              // affected file paths
  gates: QualityGate[];
}

export interface ExecutionPlan {
  id: string;
  description: string;
  assignments: TaskAssignment[];
  gates: QualityGate[];
  createdAt: string;
}

export interface PlanResult {
  plan: ExecutionPlan;
  executionResults: ExecutionResult[];
  reviewResults: ReviewResult[];
  testEvidences: TestEvidence[];
  gateResults: QualityGateResult[];
  approved: boolean;
  blockers: string[];
}

export interface AgentResolver {
  /** Selects executor, independent reviewer, and tester for a task+phase. */
  resolve(task: GruTask, phase: SddPhase): Promise<TaskAssignment>;
}

export interface SupervisionPolicy {
  /** executor.id !== reviewer.id always. */
  readonly noSelfApproval: true;
  /** If no dedicated tester: gate BLOCKED, not degraded silently. */
  requireDedicatedTester: boolean;
  requireDedicatedReviewer: boolean;
  requireIndependentReview: boolean;
  /** When harness supports it, reviewer runs with fresh context. */
  requireFreshContext: boolean;
  /** Gate fails if TestEvidence is absent. */
  blockOnMissingEvidence: boolean;
  /** Returns list of policy violations for the given assignment. Empty = valid. */
  validate(assignment: TaskAssignment): string[];
}
