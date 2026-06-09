import type { TaskClassification } from "./classification.js";
import type { DelegationProviderId, ProviderExecutionResult } from "./delegation.js";

export type DevilsSeverity = "blocker" | "warning" | "info";

export interface DevilsFinding {
  severity: DevilsSeverity;
  signal: string;
  message: string;
}

export interface DelegationReport {
  taskId: string;
  prompt: string;
  timestamp: string;
  classification: TaskClassification;
  resolvedDelegate?: DelegationProviderId;
  delegationBlocked: boolean;
  delegationBlockedReason?: string;
  execution?: ProviderExecutionResult;
  devilsFindings: DevilsFinding[];
  approved: boolean;
  blockers: string[];
}
