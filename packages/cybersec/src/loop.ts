/**
 * Purple-team cyclic self-training loop for Gru-CyberSec.
 *
 * Models the "I try to break in, Gru doesn't let me" exercise as a deterministic
 * state machine. Red attacks, blue defends, results feed learning, and difficulty
 * ratchets up each time red fails to break through. Pure reducer — no I/O — so it
 * can be unit-tested and driven by the purpleteam-coordinator agent.
 *
 * Phase order per cycle:
 *   RECON -> EXPLOIT -> ASSESS -> HARDEN -> DETECT -> REAUDIT -> LEARN
 * then either escalate difficulty (red blocked) or continue (breach found).
 */

import type { Complexity } from "./severity.js";

export type LoopPhase =
  | "recon"
  | "exploit"
  | "assess"
  | "harden"
  | "detect"
  | "reaudit"
  | "learn"
  | "hardened"; // terminal-for-now: red blocked at max difficulty

export type DifficultyTier = Complexity; // simple -> medium -> complex

const TIER_ORDER: DifficultyTier[] = ["simple", "medium", "complex"];

export interface Finding {
  patternId: string;
  breached: boolean; // did the exploit succeed in the lab?
}

export interface LoopState {
  cycle: number;
  phase: LoopPhase;
  difficulty: DifficultyTier;
  /** Findings still exploitable. */
  open: string[];
  /** Findings blue has fixed and red can no longer reproduce. */
  hardened: string[];
  /** Consecutive cycles at current difficulty where red broke nothing. */
  cleanStreak: number;
  /** Append-only log of what happened, for the agent to summarize/learn. */
  log: string[];
}

export function initLoop(difficulty: DifficultyTier = "simple"): LoopState {
  return {
    cycle: 0,
    phase: "recon",
    difficulty,
    open: [],
    hardened: [],
    cleanStreak: 0,
    log: ["LOOP_INIT difficulty=" + difficulty],
  };
}

const NEXT_PHASE: Record<LoopPhase, LoopPhase> = {
  recon: "exploit",
  exploit: "assess",
  assess: "harden",
  harden: "detect",
  detect: "reaudit",
  reaudit: "learn",
  learn: "recon",
  hardened: "recon",
};

/** Advance to the next phase. When a full cycle closes (learn->recon) the cycle counter increments. */
export function advance(state: LoopState): LoopState {
  const next = NEXT_PHASE[state.phase];
  const cycle = state.phase === "learn" ? state.cycle + 1 : state.cycle;
  return { ...state, phase: next, cycle, log: [...state.log, `PHASE ${state.phase}->${next}`] };
}

/**
 * Record the outcome of an exploit attempt during the EXPLOIT phase.
 * Breached findings go to `open`; everything else is considered held.
 */
export function recordExploit(state: LoopState, findings: Finding[]): LoopState {
  const breached = findings.filter((f) => f.breached).map((f) => f.patternId);
  const open = Array.from(new Set([...state.open, ...breached]));
  return {
    ...state,
    open,
    log: [
      ...state.log,
      `EXPLOIT cycle=${state.cycle} tier=${state.difficulty} breached=${breached.length}/${findings.length}`,
    ],
  };
}

/** Blue fixes the given findings: move them open -> hardened. */
export function recordHardening(state: LoopState, fixedPatternIds: string[]): LoopState {
  const fixed = new Set(fixedPatternIds);
  const open = state.open.filter((p) => !fixed.has(p));
  const hardened = Array.from(new Set([...state.hardened, ...fixedPatternIds]));
  return {
    ...state,
    open,
    hardened,
    log: [...state.log, `HARDEN fixed=${fixedPatternIds.length} remaining_open=${open.length}`],
  };
}

/**
 * Close a cycle and decide whether to ratchet difficulty.
 *
 * - If red broke nothing this cycle (no open findings) → cleanStreak++ and, once
 *   the streak reaches `streakToEscalate`, escalate to the next tier (reset streak).
 *   At the top tier with a clean streak, the loop reports `hardened` (inexpugnable
 *   at the current ruleset) but can always be re-armed with new patterns.
 * - If red broke something → reset streak; stay at tier; keep grinding.
 */
export function closeCycle(state: LoopState, streakToEscalate = 2): LoopState {
  const brokeSomething = state.open.length > 0;
  if (brokeSomething) {
    return {
      ...state,
      cleanStreak: 0,
      phase: "recon",
      log: [...state.log, `CYCLE_CLOSE breach_open=${state.open.length} → keep tier=${state.difficulty}`],
    };
  }
  const streak = state.cleanStreak + 1;
  if (streak < streakToEscalate) {
    return {
      ...state,
      cleanStreak: streak,
      phase: "recon",
      log: [...state.log, `CYCLE_CLOSE clean streak=${streak} → hold tier=${state.difficulty}`],
    };
  }
  // Escalate
  const idx = TIER_ORDER.indexOf(state.difficulty);
  const atTop = idx >= TIER_ORDER.length - 1;
  if (atTop) {
    return {
      ...state,
      cleanStreak: streak,
      phase: "hardened",
      log: [...state.log, `CYCLE_CLOSE clean at top tier → HARDENED (inexpugnable for current patterns)`],
    };
  }
  const nextTier = TIER_ORDER[idx + 1];
  return {
    ...state,
    difficulty: nextTier,
    cleanStreak: 0,
    phase: "recon",
    log: [...state.log, `CYCLE_CLOSE clean → ESCALATE tier ${state.difficulty}->${nextTier}`],
  };
}

/** Is the harness currently impregnable for the active pattern set? */
export function isHardened(state: LoopState): boolean {
  return state.phase === "hardened" && state.open.length === 0;
}
