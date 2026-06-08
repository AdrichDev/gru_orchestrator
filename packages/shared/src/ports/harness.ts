import type { HarnessId } from "../runtime/harness.js";

export type { HarnessId };

export type GruCapability =
  | "native-subagents"
  | "file-tools"
  | "web-search"
  | "code-execution"
  | "memory"
  | "approval-flow"
  | "documentation-retrieval"
  | "context-enrichment"
  | "streaming";

export interface GruTask {
  id: string;
  prompt: string;
  requiredCapabilities?: GruCapability[];
  preferredCapabilities?: GruCapability[];
  metadata?: Record<string, unknown>;
}

export interface GruError {
  code:
    | "HARNESS_UNAVAILABLE"
    | "CAPABILITY_UNSUPPORTED"
    | "APPROVAL_DENIED"
    | "CREDENTIALS_MISSING"
    | "PROVIDER_UNAVAILABLE"
    | "EXECUTION_FAILED"
    | "TIMEOUT"
    | "UNKNOWN";
  message: string;
  recoverable: boolean;
  cause?: unknown;
}

export interface ExecutionInfo {
  adapter: HarnessId;
  runtimeMode: "host-managed" | "sdk-managed";
  provider?: string;
  model?: string;
  command?: string;
}

export interface GruResult {
  success: boolean;
  output: string;
  harness: HarnessId;
  execution: ExecutionInfo;
  error?: GruError;
  artifacts?: string[];
}

export interface HarnessContext {
  harness: HarnessId;
  model?: string;
  modelControl: "host-managed" | "gru-managed" | "unknown";
  capabilities: GruCapability[];
  version?: string;
}

export interface HarnessAvailability {
  status:
    | "ready"
    | "degraded"
    | "missing"
    | "misconfigured"
    | "unsupported";
  reason?: string;
  version?: string;
}

export interface ApprovalRequest {
  action: string;
  description: string;
  riskLevel: 0 | 1 | 2 | 3 | 4;
  reversible: boolean;
  affectedResources?: string[];
}

export type GruExecutionEvent =
  | { type: "started"; harness: HarnessId }
  | { type: "progress"; message: string }
  | { type: "tool-call"; tool: string; input?: unknown }
  | { type: "approval-required"; request: ApprovalRequest }
  | { type: "output"; chunk: string }
  | { type: "completed"; result: GruResult }
  | { type: "failed"; error: GruError };

export interface HarnessAdapter {
  readonly id: HarnessId;

  checkAvailability(): Promise<HarnessAvailability>;

  execute(task: GruTask): Promise<GruResult>;

  stream?(task: GruTask): AsyncIterable<GruExecutionEvent>;

  supports(capability: GruCapability): boolean;

  getContext(): Promise<HarnessContext>;

  requestApproval?(request: ApprovalRequest): Promise<boolean>;
}
