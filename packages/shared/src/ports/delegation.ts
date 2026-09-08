import type { ProviderId } from "./provider.js";

/**
 * Delegation layer (3rd contract). `ProviderDelegate` is a FAÇADE over the
 * existing simple (`GruProvider`) and agentic (`ProviderAdapter`) contracts.
 * It detects capabilities, validates operations, delegates to the existing
 * runtime, and normalizes the result. It never reimplements a provider.
 */

/** Context7 lives only in the delegation layer; it is not part of the core ProviderId. */
export type DelegationProviderId = ProviderId | "context7";

/**
 * Normalized execution status. COMPLETED requires a real, terminal, recoverable
 * result — never inferred from exit code, an accepted task, a registered
 * workflow, or a pending/running state.
 */
export type ProviderExecutionStatus =
  | "COMPLETED"
  | "SUBMITTED"
  | "RUNNING"
  | "FAILED"
  | "BLOCKED"
  | "TIMEOUT"
  | "UNAVAILABLE"
  | "UNSUPPORTED";

export type ProviderDetectionStatus = "AVAILABLE" | "UNAVAILABLE" | "UNSUPPORTED";

/** Integration maturity of a delegate, surfaced honestly in detection. */
export type ProviderIntegrationStatus = "READY" | "PLANNED" | "DISABLED";

export interface ProviderDetection {
  providerId: DelegationProviderId;
  status: ProviderDetectionStatus;
  integration: ProviderIntegrationStatus;
  kind?: "cli" | "catalog" | "sdk" | "mcp" | "local";
  /** Logical or relative executable reference — never an absolute machine path. */
  executable?: string;
  version?: string;
  reason?: string;
  installHint?: string;
}

export interface ProviderCapabilityFlags {
  planning: boolean;
  sdd: boolean;
  implementation: boolean;
  review: boolean;
  testing: boolean;
  security: boolean;
  memory: boolean;
  documentation: boolean;
  skillDiscovery: boolean;
  multiAgent: boolean;
}

export type ProviderCapabilityName = keyof ProviderCapabilityFlags;

export interface ProviderCapability {
  name: ProviderCapabilityName;
  /** Operation ids the provider really supports (allowlist). */
  operations: string[];
  /** true = returns a terminal result inline; false = async submit (SUBMITTED/RUNNING). */
  synchronous: boolean;
}

export interface ContextReference {
  kind: "spec" | "documentation" | "skill" | "memory" | "artifact" | "text";
  providerId?: DelegationProviderId;
  /** Logical or relative reference — never an absolute machine path. */
  ref: string;
  summary?: string;
}

export interface ProviderExecutionRequest {
  taskId: string;
  prompt: string;
  /** Operation id; validated against the delegate's allowlist before any runtime call. */
  operation: string;
  contextRefs: ContextReference[];
  artifactRefs: string[];
  constraints: string[];
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export interface ProviderExecutionResult {
  providerId: DelegationProviderId;
  invocationId: string;
  status: ProviderExecutionStatus;
  output?: string;
  /** Logical or relative references only. */
  artifacts?: string[];
  evidenceRefs?: string[];
  /** Preserved when the underlying runtime returns one (e.g. a workflowId). */
  externalExecutionId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

/** Delegation façade contract. */
export interface ProviderDelegate {
  readonly id: DelegationProviderId;
  detect(): Promise<ProviderDetection>;
  getCapabilities(): Promise<ProviderCapability[]>;
  execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResult>;
}

export interface DelegationRegistration {
  id: DelegationProviderId;
  delegate: ProviderDelegate;
  capabilities: ProviderCapabilityFlags;
}

export interface DelegationProviderRegistry {
  /** Throws on duplicate id — no silent overwrite. */
  register(registration: DelegationRegistration): void;
  get(id: DelegationProviderId): DelegationRegistration | undefined;
  list(): DelegationRegistration[];
  /** Only delegates whose detect() returns AVAILABLE. No silent fallback. */
  getAvailable(): Promise<DelegationRegistration[]>;
}
