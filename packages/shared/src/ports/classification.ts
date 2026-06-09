export type TaskLevel = 0 | 1 | 2 | 3 | 4;

export type TaskViability = "ready" | "blocked" | "needs_approval" | "unsupported";

export type MinionRole =
  | "minion-filesystem"
  | "minion-architect"
  | "minion-builder"
  | "minion-reviewer"
  | "minion-tester"
  | "minion-devil"
  | "minion-security"
  | "minion-docs"
  | "minion-mcp"
  | "minion-memory";

export interface ClassificationSignals {
  filesAffected?: number;
  domainsCrossed?: number;
  requiresNewArchitecture?: boolean;
  unknownLibrary?: boolean;
  newExternalDependency?: boolean;
  isIrreversible?: boolean;
  touchesProduction?: boolean;
  touchesSecurityOrAuth?: boolean;
  generatesFinancialCost?: boolean;
  touchesPersistentData?: boolean;
  touchesMainBranch?: boolean;
  missingCapability?: string;
}

export interface TaskClassification {
  complexityScore: number;
  riskScore: number;
  totalScore: number;
  level: TaskLevel;
  levelName: "Trivial" | "Small" | "Medium" | "Large" | "Critical";
  viability: TaskViability;
  blockedReason?: string;
  requiresDevilsAdvocate: boolean;
  requiresHumanApproval: boolean;
  suggestedMinions: MinionRole[];
  inferredSignals: Partial<ClassificationSignals>;
  signals: ClassificationSignals;
}
