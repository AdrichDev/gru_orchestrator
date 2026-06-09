import type { TaskClassification } from "./classification.js";

export interface GateOptions {
  forceApproval?: boolean;
}

export interface GateResult {
  allowed: boolean;
  classification: TaskClassification;
  blockers: string[];
}
