import type { AgentDescriptor, SddPhase } from "./agent.js";
import type { GruError } from "./harness.js";

export type QualityGateId =
  | "spec-compliance"
  | "code-regression"
  | "security"
  | "test-evidence"
  | "review-independence"
  | "sdd-traceability";

export type QualityGateStatus = "passed" | "failed" | "blocked" | "skipped";

export interface QualityGateResult {
  gate: QualityGateId;
  status: QualityGateStatus;
  reason?: string;
  evidence?: string[];
}

export interface ExecutionResult {
  assignmentId: string;
  agent: AgentDescriptor;
  phase: SddPhase;
  success: boolean;
  output: string;
  affectedFiles: string[];
  artifacts: string[];
  error?: GruError;
  startedAt: string;
  finishedAt: string;
}

export interface ReviewResult {
  assignmentId: string;
  reviewer: AgentDescriptor;
  approved: boolean;
  findings: ReviewFinding[];
  blockers: string[];
  suggestions: string[];
  completedAt: string;
}

export interface ReviewFinding {
  severity: "blocker" | "major" | "minor" | "info";
  location?: string;
  message: string;
  fixRequired: boolean;
}

export interface TestEvidence {
  assignmentId: string;
  tester: AgentDescriptor;
  passed: boolean;
  suites: TestSuiteResult[];
  coverage?: number;
  regressions: string[];
  completedAt: string;
}

export interface TestSuiteResult {
  name: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}
