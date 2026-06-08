import type {
  GruProvider,
  ProviderAvailability,
  ProviderId,
} from "../../../shared/src/ports/provider.js";
import type {
  ProviderAdapter,
  TaskAssignment,
} from "../../../shared/src/ports/orchestration.js";
import type { ExecutionResult } from "../../../shared/src/ports/results.js";
import type { AgentDescriptor, SddPhase } from "../../../shared/src/ports/agent.js";
import type {
  ProviderDelegate,
  ProviderDetection,
  ProviderExecutionRequest,
  ProviderExecutionResult,
  ProviderExecutionStatus,
  ProviderCapability,
  DelegationProviderId,
  ProviderIntegrationStatus,
} from "../../../shared/src/ports/delegation.js";
import { capabilitiesFor, allowlistFor } from "./capabilities.js";

/** Matches an absolute machine path (drive-letter or POSIX root). */
export const ABSOLUTE_PATH = /(^[A-Za-z]:[\\/])|(^\/)/;

export function makeInvocationId(id: string): string {
  return `inv_${id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Drops absolute paths so they never become canonical persisted refs. */
export function stripAbsolute(ref?: string): string | undefined {
  if (!ref) return undefined;
  return ABSOLUTE_PATH.test(ref) ? undefined : ref;
}

export function mapAvailabilityToDetection(
  id: DelegationProviderId,
  av: ProviderAvailability,
  integration: ProviderIntegrationStatus,
): ProviderDetection {
  return {
    providerId: id,
    status: av.available ? "AVAILABLE" : "UNAVAILABLE",
    integration,
    kind: av.kind,
    executable: stripAbsolute(av.executable),
    version: av.version,
    reason: av.reason,
    installHint: av.installHint,
  };
}

/**
 * Validates the requested operation against the provider's allowlist.
 * Returns an UNSUPPORTED result (without touching the runtime) when the
 * operation is not supported; otherwise returns undefined.
 */
export function assertOperation(
  id: DelegationProviderId,
  req: ProviderExecutionRequest,
): ProviderExecutionResult | undefined {
  if (allowlistFor(id).includes(req.operation)) return undefined;
  return {
    providerId: id,
    invocationId: makeInvocationId(id),
    status: "UNSUPPORTED",
    error: `Operation not supported by provider: ${req.operation}`,
    metadata: { operation: req.operation, reason: "Operation not supported by provider" },
  };
}

/**
 * Calls an existing synchronous `GruProvider.run()` and normalizes the result.
 * Only for providers that return a terminal result inline — never used to fake
 * a synchronous result over an async/contextual mechanism.
 */
export async function wrapSyncRun(
  id: DelegationProviderId,
  provider: GruProvider,
  req: ProviderExecutionRequest,
): Promise<ProviderExecutionResult> {
  const invocationId = makeInvocationId(id);

  const av = await provider.checkAvailability();
  if (!av.available) {
    return {
      providerId: id,
      invocationId,
      status: "UNAVAILABLE",
      error: av.reason ?? "Provider unavailable",
      metadata: { installHint: av.installHint, operation: req.operation },
    };
  }

  const r = await provider.run({
    taskId: req.taskId,
    prompt: req.prompt,
    mode: req.operation,
    metadata: req.metadata,
  });

  return {
    providerId: id,
    invocationId,
    status: r.success ? "COMPLETED" : "FAILED",
    output: r.output,
    error: r.success ? undefined : r.error ?? r.output,
    metadata: { operation: req.operation, exitCode: r.exitCode },
  };
}

/** Façade over the simple `GruProvider` contract. */
export class SimpleProviderDelegate implements ProviderDelegate {
  constructor(
    readonly id: DelegationProviderId,
    protected readonly provider: GruProvider,
    protected readonly integration: ProviderIntegrationStatus = "READY",
  ) {}

  async detect(): Promise<ProviderDetection> {
    return mapAvailabilityToDetection(this.id, await this.provider.checkAvailability(), this.integration);
  }

  async getCapabilities(): Promise<ProviderCapability[]> {
    return capabilitiesFor(this.id);
  }

  async execute(req: ProviderExecutionRequest): Promise<ProviderExecutionResult> {
    const guard = assertOperation(this.id, req);
    if (guard) return guard;
    return wrapSyncRun(this.id, this.provider, req);
  }
}

const WORKFLOW_STATE_TO_STATUS: Record<string, ProviderExecutionStatus> = {
  completed: "COMPLETED",
  failed: "FAILED",
  timeout: "TIMEOUT",
  unknown: "UNSUPPORTED",
  submitted: "SUBMITTED",
  queued: "SUBMITTED",
  running: "RUNNING",
};

function syntheticAgent(providerId: ProviderId, operation: string): AgentDescriptor {
  return {
    id: `agent-${operation}`,
    provider: providerId,
    sourcePath: `${providerId}:delegate:${operation}`,
    name: operation,
    description: `Delegation operation ${operation}`,
    capabilities: [operation],
    supportedPhases: [],
    tools: [],
    skills: [],
    executionMode: "write",
    riskLevel: 2,
    canWrite: true,
    canReview: true,
    canTest: true,
    availability: "available",
  };
}

/**
 * Normalizes an agentic `ExecutionResult` into a delegation result, honoring the
 * honest-status rule: COMPLETED only when the underlying workflow state is
 * terminal-completed. Preserves the external workflow id and portable artifacts.
 */
export function normalizeExecutionResult(
  id: DelegationProviderId,
  invocationId: string,
  exec: ExecutionResult,
): ProviderExecutionResult {
  const wfArtifact = (exec.artifacts ?? []).find((a) => /^[a-z-]+:workflow:/i.test(a));
  let externalExecutionId: string | undefined;
  let state: string | undefined;
  if (wfArtifact) {
    const parts = wfArtifact.split(":");
    externalExecutionId = parts[2];
    state = parts[3];
  }

  const status: ProviderExecutionStatus =
    state && WORKFLOW_STATE_TO_STATUS[state]
      ? WORKFLOW_STATE_TO_STATUS[state]
      : exec.success
        ? "COMPLETED"
        : "FAILED";

  return {
    providerId: id,
    invocationId,
    status,
    output: exec.output,
    artifacts: (exec.artifacts ?? []).filter((a) => !ABSOLUTE_PATH.test(a)),
    externalExecutionId,
    error: exec.error?.message,
    metadata: { phase: exec.phase, operation: exec.agent.name },
  };
}

/** Façade over the agentic `ProviderAdapter` contract (e.g. Ruflo workflows). */
export class AgenticProviderDelegate implements ProviderDelegate {
  constructor(
    readonly id: DelegationProviderId,
    private readonly adapter: ProviderAdapter,
    private readonly integration: ProviderIntegrationStatus = "READY",
  ) {}

  async detect(): Promise<ProviderDetection> {
    const s = await this.adapter.checkAvailability();
    const status =
      s.status === "available" ? "AVAILABLE" : s.status === "unsupported" ? "UNSUPPORTED" : "UNAVAILABLE";
    return {
      providerId: this.id,
      status,
      integration: this.integration,
      version: s.version,
      reason: s.reason,
    };
  }

  async getCapabilities(): Promise<ProviderCapability[]> {
    return capabilitiesFor(this.id);
  }

  async execute(req: ProviderExecutionRequest): Promise<ProviderExecutionResult> {
    const guard = assertOperation(this.id, req);
    if (guard) return guard;

    const invocationId = makeInvocationId(this.id);
    const phase = (req.metadata?.phase as SddPhase) ?? "apply";
    const agent = syntheticAgent(this.id as ProviderId, req.operation);
    const assignment: TaskAssignment = {
      id: req.taskId,
      task: { id: req.taskId, prompt: req.prompt, metadata: { role: "executor", operation: req.operation } },
      phase,
      executor: agent,
      reviewer: agent,
      tester: agent,
      scope: [],
      gates: [],
    };

    const exec = await this.adapter.execute(assignment);
    return normalizeExecutionResult(this.id, invocationId, exec);
  }
}
