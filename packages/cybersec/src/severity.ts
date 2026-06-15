/**
 * Severity taxonomy for Gru-CyberSec.
 *
 * Aligns with the existing `sast-sca-security-analyzer` agent taxonomy and a
 * CVSS-lite scoring model. Pure functions only — no side effects, fully testable.
 */

export type SeverityLabel =
  | "informational"
  | "low"
  | "medium"
  | "high"
  | "critical";

/** Difficulty / blast-radius bucket used to route the work to the right team. */
export type Complexity = "simple" | "medium" | "complex";

export const SEVERITY_NUMERIC: Record<SeverityLabel, number> = {
  informational: 1,
  low: 2,
  medium: 3,
  high: 4,
  critical: 5,
};

/**
 * CVSS-lite input. Each axis is normalized 0..1. This is intentionally a small
 * surrogate of CVSS v3.1 base metrics — enough to rank findings deterministically
 * without pulling a heavy dependency.
 */
export interface RiskVector {
  /** How reachable is the flaw? 1 = remote/unauthenticated, 0 = local/manual. */
  exploitability: number;
  /** Confidentiality/Integrity/Availability impact, 1 = full compromise. */
  impact: number;
  /** Does it require privileges/auth? 1 = none required, 0 = high privilege. */
  exposure: number;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * Deterministic 0..10 score. Weighted: impact dominates, exploitability and
 * exposure modulate it. Mirrors CVSS intuition (a high-impact bug that is hard
 * to reach scores lower than a high-impact bug that is trivially reachable).
 */
export function scoreRisk(v: RiskVector): number {
  const e = clamp01(v.exploitability);
  const i = clamp01(v.impact);
  const x = clamp01(v.exposure);
  const raw = (i * 0.5 + e * 0.3 + x * 0.2) * 10;
  return Math.round(raw * 10) / 10;
}

/** Map a 0..10 score to a severity label. */
export function labelForScore(score: number): SeverityLabel {
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  if (score >= 0.1) return "low";
  return "informational";
}

/** Convenience: score a vector and return both number and label. */
export function classifyRisk(v: RiskVector): {
  score: number;
  label: SeverityLabel;
  numeric: number;
} {
  const score = scoreRisk(v);
  const label = labelForScore(score);
  return { score, label, numeric: SEVERITY_NUMERIC[label] };
}

/**
 * Map a finding severity to which team owns the first response and at what
 * Gru classification level it should be escalated. Keeps the cybersec harness
 * consistent with the kernel's Decision Table levels (0..4).
 */
export function escalationFor(label: SeverityLabel): {
  gruLevel: 0 | 1 | 2 | 3 | 4;
  humanApproval: boolean;
  owner: "blue" | "purple";
} {
  switch (label) {
    case "critical":
      return { gruLevel: 4, humanApproval: true, owner: "purple" };
    case "high":
      return { gruLevel: 3, humanApproval: true, owner: "purple" };
    case "medium":
      return { gruLevel: 2, humanApproval: false, owner: "blue" };
    case "low":
      return { gruLevel: 1, humanApproval: false, owner: "blue" };
    default:
      return { gruLevel: 0, humanApproval: false, owner: "blue" };
  }
}
