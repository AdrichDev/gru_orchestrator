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

// Bilingual (EN + ES) risk patterns. The harness speaks Spanish — risk
// detection MUST understand Spanish prompts or the human-approval gate
// can be silently bypassed (e.g. "borra la base de datos de producción").
const PROMPT_PATTERNS: Array<[keyof ClassificationSignals, RegExp]> = [
  [
    "touchesProduction",
    /\bprod(uction)?\b|\bproducci[oó]n\b|\bproductivo\b|deploy|despleg|despliegue|release|publish|publicar?\b|\ben\s+vivo\b|\blive\b|\bhotfix\b/i,
  ],
  [
    "touchesSecurityOrAuth",
    /\bsecurity\b|\bseguridad\b|\bauth\b|\bautenticaci[oó]n\b|\bautorizaci[oó]n\b|\bcve\b|\bcredencial(es)?\b|\bcredential\b|\bsecret\b|\bsecreto\b|\btoken\b|\bcontrase[ñn]a\b|\bpassword\b|\.env\b|\bapi[\s_-]?keys?\b/i,
  ],
  [
    "isIrreversible",
    // Verbos destructivos ES/EN. "limpia/descarta/formatea" solo cuentan en
    // contexto de datos/almacenamiento para no bloquear "limpia el código" o
    // "formatea el código con prettier".
    /\bdelete\b|\bdrop\b|\bremove\b|\bmigrat|\bborra(r|d[oa])?\b|\belimina(r|d[oa])?\b|\bdestru(ye|ir)\b|\bpurga(r)?\b|\btrunca(r|te)?\b|\bmigraci[oó]n\b|\bvac[ií]a(r)?\b|\bresetea(r)?\b|\bwipe\b|\bsuprim(e|ir)\b|\bdeshazte\b|\b(limpia(r)?|descarta(r)?)\b[^.]*\b(registros?|tablas?|datos|base|esquema|schema|logs?|cambios)\b|\bformatea(r)?\b[^.]*\b(disco|unidad|partici[oó]n|pendrive|usb|drive|entorno)\b/i,
  ],
  [
    "isIrreversible",
    // Comandos crudos shell/SQL/git destructivos incrustados en el prompt.
    /\brm\s+-[a-z]*r[a-z]*\b|\brmdir\b|\bdel\s+\/[sq]\b|\bgit\s+reset\s+--hard\b|\bgit\s+clean\s+-[a-z]*f|--force\b|\bforce[- ]push\b|\bfuerza\s+(el\s+)?push\b|\btruncate\s+table\b|\bdelete\s+from\b|\bdrop\s+(database|table|schema)\b|\bsudo\s+rm\b/i,
  ],
  [
    "touchesPersistentData",
    /\bmigrat|\bmigraci[oó]n\b|\bdatabase\b|\bbase\s+de\s+datos\b|\bschema\b|\besquema\b|\bbackup\b|\bcopia\s+de\s+seguridad\b/i,
  ],
  [
    "touchesMainBranch",
    /\bmain\b|\bmaster\b|\brama\s+principal\b|\bpush\s+(a|to)\s+main\b/i,
  ],
  [
    "requiresNewArchitecture",
    /\bnew architecture\b|\bredesign\b|\bnueva\s+arquitectura\b|\bredise[ñn](o|ar)\b/i,
  ],
  [
    "generatesFinancialCost",
    /\bgasto\b|\bcoste\b|\bcosto\b|\bfacturaci[oó]n\b|\bbilling\b|\bcompra(r)?\b|\bpago(s)?\b|\bsuscripci[oó]n\b|\bcr[eé]ditos\b|\bupgrade\b|\bplan\s+(superior|premium|pro|enterprise)\b|\b(sube|cambia|mejora)\b[^.]*\bplan\b|\bprovision(a|ar|ing)?\b.*\b(aws|gcp|azure|cloud)\b|\b(aws|gcp|azure)\b.*\bprovision/i,
  ],
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
