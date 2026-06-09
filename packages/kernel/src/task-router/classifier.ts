import type {
  ClassificationSignals,
  MinionRole,
  TaskClassification,
  TaskLevel,
  TaskViability,
} from "../../../shared/src/ports/classification.js";

const LEVEL_NAMES: Record<TaskLevel, TaskClassification["levelName"]> = {
  0: "Trivial",
  1: "Small",
  2: "Medium",
  3: "Large",
  4: "Critical",
};

const MINIONS_BY_LEVEL: Record<TaskLevel, MinionRole[]> = {
  0: ["minion-builder"],
  1: ["minion-filesystem", "minion-builder"],
  2: ["minion-filesystem", "minion-architect", "minion-builder", "minion-devil"],
  3: ["minion-filesystem", "minion-architect", "minion-builder", "minion-devil", "minion-reviewer", "minion-tester"],
  4: ["minion-filesystem", "minion-architect", "minion-builder", "minion-devil", "minion-reviewer", "minion-tester", "minion-security", "minion-memory"],
};

export function scoreComplexity(signals: ClassificationSignals): number {
  let score = 0;
  const files = signals.filesAffected ?? 1;
  if (files >= 4) score += 2;
  else if (files >= 2) score += 1;
  if ((signals.domainsCrossed ?? 0) >= 2) score += 2;
  if (signals.requiresNewArchitecture) score += 2;
  if (signals.unknownLibrary) score += 1;
  if (signals.newExternalDependency) score += 1;
  return score;
}

export function scoreRisk(signals: ClassificationSignals): number {
  let score = 0;
  if (signals.isIrreversible) score += 3;
  if (signals.touchesProduction) score += 3;
  if (signals.touchesSecurityOrAuth) score += 3;
  if (signals.generatesFinancialCost) score += 2;
  if (signals.touchesPersistentData) score += 2;
  if (signals.touchesMainBranch) score += 2;
  return score;
}

export function levelFromScore(total: number): TaskLevel {
  if (total === 0) return 0;
  if (total <= 2) return 1;
  if (total <= 4) return 2;
  if (total <= 7) return 3;
  return 4;
}

export function resolveViability(signals: ClassificationSignals, _riskScore: number): TaskViability {
  if (signals.missingCapability) return "blocked";
  if (
    signals.touchesSecurityOrAuth ||
    signals.touchesProduction ||
    signals.isIrreversible ||
    signals.generatesFinancialCost ||
    signals.touchesMainBranch
  ) return "needs_approval";
  return "ready";
}

const PROMPT_PATTERNS: Array<[keyof ClassificationSignals, RegExp]> = [
  ["touchesProduction", /\bprod(uction)?\b|deploy|release|publish/i],
  ["touchesSecurityOrAuth", /\bsecurity\b|\bauth\b|\bcve\b|\bcredential\b|\bsecret\b|\btoken\b/i],
  ["isIrreversible", /\bdelete\b|\bdrop\b|\bremove\b|\bmigrat/i],
  ["touchesPersistentData", /\bmigrat|\bdatabase\b|\bschema\b/i],
  ["touchesMainBranch", /\bmain\b|\bmaster\b/i],
  ["requiresNewArchitecture", /\bnew architecture\b|\bredesign\b/i],
];

export function inferSignalsFromPrompt(prompt: string): Partial<ClassificationSignals> {
  const result: Partial<ClassificationSignals> = {};
  for (const [key, pattern] of PROMPT_PATTERNS) {
    if (pattern.test(prompt)) {
      (result as Record<string, boolean>)[key as string] = true;
    }
  }
  return result;
}

export function classifyTask(prompt: string, signals: ClassificationSignals = {}): TaskClassification {
  const inferredSignals = inferSignalsFromPrompt(prompt);
  const merged: ClassificationSignals = { ...inferredSignals, ...signals };

  const complexityScore = scoreComplexity(merged);
  const riskScore = scoreRisk(merged);
  const totalScore = complexityScore + riskScore;
  const level = levelFromScore(totalScore);
  const viability = resolveViability(merged, riskScore);

  return {
    complexityScore,
    riskScore,
    totalScore,
    level,
    levelName: LEVEL_NAMES[level],
    viability,
    blockedReason: viability === "blocked" ? `missing capability: ${merged.missingCapability}` : undefined,
    requiresDevilsAdvocate: level >= 2,
    requiresHumanApproval: level >= 4 || viability === "needs_approval",
    suggestedMinions: MINIONS_BY_LEVEL[level],
    inferredSignals,
    signals: merged,
  };
}
