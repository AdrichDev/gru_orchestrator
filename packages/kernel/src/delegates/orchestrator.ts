import type {
  DelegationProviderId,
  ProviderExecutionRequest,
  ProviderExecutionResult,
  ContextReference,
} from "../../../shared/src/ports/delegation.js";
import type { DefaultDelegationRegistry } from "./registry.js";
import { resolveDelegate } from "./resolver.js";
import { stripAbsolute, makeInvocationId } from "./base.js";

// ── Portable reference helpers ────────────────────────────────────────────────

/**
 * Sanitizes a raw reference string into a portable (non-absolute) ref.
 * Returns `undefined` when the input is an absolute machine path so it is
 * never persisted or forwarded as a canonical ref.
 */
export function toPortableRef(raw: string): string | undefined {
  return stripAbsolute(raw);
}

/**
 * Builds a `ProviderExecutionRequest` from a minimal set of arguments.
 * All optional collections default to empty; the `taskId` is auto-generated
 * when not provided. Absolute-path context refs are silently dropped.
 */
export function portableRequest(opts: {
  operation: string;
  prompt: string;
  taskId?: string;
  contextRefs?: Array<{ kind: ContextReference["kind"]; ref: string; summary?: string; providerId?: DelegationProviderId }>;
  artifactRefs?: string[];
  constraints?: string[];
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}): ProviderExecutionRequest {
  const taskId = opts.taskId ?? `del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const contextRefs: ContextReference[] = (opts.contextRefs ?? []).flatMap((cr) => {
    const portable = toPortableRef(cr.ref);
    if (!portable) return [];
    return [{ kind: cr.kind, ref: portable, summary: cr.summary, providerId: cr.providerId }];
  });

  const artifactRefs = (opts.artifactRefs ?? []).flatMap((r) => {
    const portable = toPortableRef(r);
    return portable ? [portable] : [];
  });

  return {
    taskId,
    prompt: opts.prompt,
    operation: opts.operation,
    contextRefs,
    artifactRefs,
    constraints: opts.constraints ?? [],
    timeoutMs: opts.timeoutMs,
    metadata: opts.metadata,
  };
}

/**
 * Wraps a raw `ProviderExecutionResult` into a `DelegationRunResult`, stripping
 * any absolute paths from artifact refs and adding a portable `runId`.
 */
export function portableResult(raw: ProviderExecutionResult): DelegationRunResult {
  return {
    runId: makeInvocationId(String(raw.providerId)),
    providerId: raw.providerId,
    invocationId: raw.invocationId,
    status: raw.status,
    output: raw.output,
    artifacts: (raw.artifacts ?? []).flatMap((a) => {
      const portable = toPortableRef(a);
      return portable ? [portable] : [];
    }),
    evidenceRefs: raw.evidenceRefs,
    externalExecutionId: raw.externalExecutionId,
    error: raw.error,
    metadata: raw.metadata,
  };
}

// ── DelegationRunResult ───────────────────────────────────────────────────────

/**
 * Normalized result from `DelegationOrchestrator.delegate()`.
 * Extends `ProviderExecutionResult` with a stable `runId` and guaranteed
 * portable (non-absolute) artifact refs.
 */
export interface DelegationRunResult extends ProviderExecutionResult {
  /** Stable orchestrator-level run identifier (differs from invocationId). */
  runId: string;
}

// ── DelegationOrchestrator ────────────────────────────────────────────────────

/**
 * Thin orchestration layer over the delegation registry + resolver.
 *
 * Responsibilities:
 * - Accepts an explicit `providerId` (direct dispatch) OR resolves the first
 *   available delegate for the requested `operation` via `resolveDelegate`.
 * - Validates that the resolved delegate supports the operation (via the
 *   resolver's allowlist check — no extra re-check needed here).
 * - Normalizes the result into a portable `DelegationRunResult` (no absolute
 *   paths, stable `runId`).
 *
 * What it does NOT do:
 * - It does NOT replace the existing `orchestrateTask` / `orchestrateAgenticTask`
 *   pipelines (risk gates, Devil's Advocate, human-in-the-loop).
 * - It does NOT bypass availability guards — unavailable delegates are excluded
 *   from `resolveDelegate` via `registry.getAvailable()`.
 * - It does NOT re-implement provider logic; it delegates 100% to the existing
 *   `ProviderDelegate.execute()` contract.
 *
 * Guard-pipeline gap (documented):
 * When invoked from `gru delegate` CLI, the full risk-classification +
 * Devil's-Advocate + human-approval pipeline from `orchestrateTask` is NOT
 * wired. The delegate subcommand is intended for direct, explicit provider
 * invocation (e.g., CI pipelines, scripting), so the caller is assumed to have
 * made the risk decision externally. If the full guard pipeline is required,
 * use `orchestrateTask` instead.
 */
export class DelegationOrchestrator {
  constructor(private readonly registry: DefaultDelegationRegistry) {}

  /**
   * Delegates an operation to a specific provider (when `providerId` is given)
   * or to the first available provider that supports `operation`.
   *
   * Returns a `DelegationRunResult` with portable artifact refs and a stable
   * `runId`. Status semantics mirror `ProviderExecutionStatus`:
   * - `COMPLETED` — terminal success with real output.
   * - `SUBMITTED` / `RUNNING` — async provider accepted the work.
   * - `FAILED` — provider executed but produced an error result.
   * - `UNAVAILABLE` — no matching available provider found.
   * - `UNSUPPORTED` — provider found but operation is not in its allowlist.
   * - `BLOCKED` — resolver found no available delegate for the operation.
   */
  async delegate(opts: {
    operation: string;
    prompt: string;
    providerId?: DelegationProviderId;
    taskId?: string;
    contextRefs?: Array<{ kind: ContextReference["kind"]; ref: string; summary?: string; providerId?: DelegationProviderId }>;
    artifactRefs?: string[];
    constraints?: string[];
    timeoutMs?: number;
    metadata?: Record<string, unknown>;
  }): Promise<DelegationRunResult> {
    const req = portableRequest(opts);

    // ── Provider resolution ──────────────────────────────────────────────────
    let delegate: import("../../../shared/src/ports/delegation.js").ProviderDelegate;
    let resolvedProviderId: DelegationProviderId;

    if (opts.providerId) {
      // Direct dispatch: look up the specific provider in the registry.
      const registration = this.registry.get(opts.providerId);
      if (!registration) {
        return portableResult({
          providerId: opts.providerId,
          invocationId: makeInvocationId(String(opts.providerId)),
          status: "UNAVAILABLE",
          error: `Provider '${opts.providerId}' is not registered in the delegation registry.`,
          metadata: { operation: opts.operation },
        });
      }

      // Verify the provider is actually available before dispatching.
      const detection = await registration.delegate.detect();
      if (detection.status !== "AVAILABLE") {
        return portableResult({
          providerId: opts.providerId,
          invocationId: makeInvocationId(String(opts.providerId)),
          status: "UNAVAILABLE",
          error: detection.reason ?? `Provider '${opts.providerId}' is not available.`,
          metadata: { operation: opts.operation, installHint: detection.installHint },
        });
      }

      delegate = registration.delegate;
      resolvedProviderId = opts.providerId;
    } else {
      // Auto-resolve: find the first available delegate for the operation.
      const resolution = await resolveDelegate(opts.operation, this.registry);
      if (resolution.blocked) {
        return portableResult({
          providerId: "local",
          invocationId: makeInvocationId("unresolved"),
          status: "BLOCKED" as const,
          error: resolution.reason,
          metadata: { operation: opts.operation, installHint: resolution.installHint },
        });
      }
      delegate = resolution.delegate;
      resolvedProviderId = resolution.delegateId;
    }

    // ── Execute and normalize ────────────────────────────────────────────────
    const raw = await delegate.execute({ ...req, metadata: { ...req.metadata, resolvedProviderId } });
    return portableResult(raw);
  }
}

/**
 * Factory that wires a fresh `DelegationOrchestrator` over the supplied
 * registry. Prefer `createDelegationOrchestrator` from `delegates/index.ts`
 * which provides a pre-populated registry.
 */
export function createOrchestratorFromRegistry(
  registry: DefaultDelegationRegistry,
): DelegationOrchestrator {
  return new DelegationOrchestrator(registry);
}
