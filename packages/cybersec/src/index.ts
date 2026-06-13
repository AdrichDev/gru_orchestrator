/**
 * @gru/cybersec — Gru-CyberSec harness.
 *
 * Pure, testable building blocks for the Blue/Red/Purple team subsystem:
 *   - severity:  taxonomy + CVSS-lite scoring + Gru-level escalation
 *   - patterns:  attack/defense catalog (OWASP/CWE), simple→complex
 *   - teams:     cybersecurity minion registry + skill bundles
 *   - loop:      cyclic red-vs-blue self-training state machine
 *   - learning:  self-learning records persisted to Engram
 *
 * Gru orchestrates; cybersec minions produce. This package holds the data and
 * logic; the agents/skills under .claude/ hold the behavior.
 */

export * from "./severity.js";
export * from "./patterns.js";
export * from "./teams.js";
export * from "./loop.js";
export * from "./learning.js";

export const GRU_CYBERSEC_VERSION = "0.1.0";
