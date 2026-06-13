/**
 * Self-learning record format for Gru-CyberSec.
 *
 * Every loop cycle produces a LearningRecord. The purpleteam-coordinator persists
 * it to Engram so future sessions start smarter: known-good defenses, recurring
 * weak spots, and which exploits red has already retired. This is the substrate
 * for "agents that train themselves" — until the loop is autonomous, Gru drives it.
 */

import type { Complexity, SeverityLabel } from "./severity.js";
import type { Team } from "./patterns.js";

export type LearningKind = "defense" | "exploit-retired" | "weak-spot" | "regression";

export interface LearningRecord {
  kind: LearningKind;
  patternId: string;
  team: Team;
  difficulty: Complexity;
  severity: SeverityLabel;
  /** What was learned, in one or two sentences. */
  lesson: string;
  /** The reusable secure pattern or detection, if any. */
  artifact?: string;
  cycle: number;
  /** ISO date; caller supplies (kept injectable for determinism in tests). */
  date: string;
}

/**
 * Build the Engram key, consistent with the project's
 * `project:[name]:[category]:[short-id]` convention.
 */
export function engramKey(project: string, record: LearningRecord): string {
  const category = `cybersec:${record.kind}`;
  return `project:${project}:${category}:${record.patternId}`;
}

/** Caveman one-liner for the Scope Completion Protocol / user surface. */
export function cavemanLine(record: LearningRecord): string {
  return [
    `CYBERSEC ${record.kind.toUpperCase()}`,
    `pattern=${record.patternId}`,
    `team=${record.team}`,
    `tier=${record.difficulty}`,
    `sev=${record.severity}`,
    `cycle=${record.cycle}`,
    `→ ${record.lesson}`,
  ].join(" ");
}

/** Merge new records into prior memory, de-duplicating by key, newest wins. */
export function mergeLearning(
  project: string,
  prior: LearningRecord[],
  incoming: LearningRecord[],
): LearningRecord[] {
  const byKey = new Map<string, LearningRecord>();
  for (const r of prior) byKey.set(engramKey(project, r), r);
  for (const r of incoming) byKey.set(engramKey(project, r), r);
  return Array.from(byKey.values());
}
