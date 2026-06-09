import type { DelegationProviderId, ProviderExecutionResult } from "../../../shared/src/ports/delegation.js";
import type { TaskClassification } from "../../../shared/src/ports/classification.js";
import type { DevilsFinding, DelegationReport } from "../../../shared/src/ports/report.js";

type Resolution =
  | { blocked: false; delegateId: DelegationProviderId }
  | { blocked: true; reason: string; installHint?: string };

export function deriveDevilsFindings(classification: TaskClassification): DevilsFinding[] {
  if (!classification.requiresDevilsAdvocate) return [];

  const findings: DevilsFinding[] = [];
  const s = classification.signals;

  if (s.touchesSecurityOrAuth) findings.push({
    severity: "blocker",
    signal: "touchesSecurityOrAuth",
    message: "Security/auth change — requires security audit and explicit approval.",
  });
  if (s.isIrreversible) findings.push({
    severity: "blocker",
    signal: "isIrreversible",
    message: "Irreversible change — verify backup or recovery procedure exists.",
  });
  if (s.touchesProduction) findings.push({
    severity: "warning",
    signal: "touchesProduction",
    message: "Touches production environment — validate in staging first.",
  });
  if (s.touchesPersistentData) findings.push({
    severity: "warning",
    signal: "touchesPersistentData",
    message: "Touches persistent data — migration must be reversible.",
  });
  if (s.generatesFinancialCost) findings.push({
    severity: "warning",
    signal: "generatesFinancialCost",
    message: "Generates financial cost — confirm budget approval.",
  });
  if (classification.level >= 4) findings.push({
    severity: "info",
    signal: "level",
    message: "Critical complexity — consider splitting into smaller tasks.",
  });

  return findings;
}

export function buildDelegationReport(params: {
  taskId: string;
  prompt: string;
  classification: TaskClassification;
  resolution: Resolution;
  execution?: ProviderExecutionResult;
}): DelegationReport {
  const { taskId, prompt, classification, resolution, execution } = params;

  const devilsFindings = deriveDevilsFindings(classification);
  const delegationBlocked = resolution.blocked;
  const resolvedDelegate = resolution.blocked ? undefined : resolution.delegateId;
  const delegationBlockedReason = resolution.blocked ? resolution.reason : undefined;

  const blockers: string[] = [];

  if (delegationBlocked) {
    blockers.push(`delegation:BLOCKED — ${delegationBlockedReason}`);
  }
  if (execution && execution.status !== "COMPLETED") {
    blockers.push(`execution:${execution.status} — ${execution.error ?? "no output"}`);
  }
  if (classification.viability === "needs_approval") {
    blockers.push("classification:NEEDS_APPROVAL — human approval required");
  }

  const executionFailed = execution !== undefined && execution.status !== "COMPLETED";
  const approved = !delegationBlocked && !executionFailed && classification.viability !== "needs_approval";

  return {
    taskId,
    prompt,
    timestamp: new Date().toISOString(),
    classification,
    resolvedDelegate,
    delegationBlocked,
    delegationBlockedReason,
    execution,
    devilsFindings,
    approved,
    blockers,
  };
}
