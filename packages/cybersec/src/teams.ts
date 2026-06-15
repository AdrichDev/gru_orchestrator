/**
 * Team registry for Gru-CyberSec.
 *
 * Declarative map of the cybersecurity minions Gru delegates to. Each entry
 * points at its agent file (.claude/agents/cybersec/*) and the skills it must
 * load before working. Gru reads this to resolve who handles a finding and which
 * SKILL.md paths to inject into the sub-agent prompt (Skill Resolver Protocol).
 */

import type { Team } from "./patterns.js";

export interface CyberAgent {
  /** subagent_type string used in Agent(). */
  id: string;
  team: Team;
  role: string;
  /** Relative path to the agent definition. */
  agentFile: string;
  /** SKILL.md paths the orchestrator must inject before the agent works. */
  skills: string[];
  /** Recommended model alias for this agent's typical workload. */
  model: "haiku" | "sonnet" | "opus";
  /** One-line charter. */
  charter: string;
}

const CONTRACT = "cybersec-minion-contract.md";

export const TEAM_REGISTRY: readonly CyberAgent[] = [
  // ---- RED TEAM -------------------------------------------------------------
  {
    id: "cybersec:redteam-coordinator",
    team: "red",
    role: "Red Team Lead",
    agentFile: ".claude/agents/cybersec/redteam-coordinator.agent.md",
    skills: [".claude/skills/redteam-attack/SKILL.md", ".claude/skills/threat-modeling/SKILL.md"],
    model: "opus",
    charter: "Plans the offensive campaign, sequences recon→exploit, never acts outside authorized scope.",
  },
  {
    id: "cybersec:redteam-recon",
    team: "red",
    role: "Recon / Mapping",
    agentFile: ".claude/agents/cybersec/redteam-recon.agent.md",
    skills: [".claude/skills/redteam-attack/SKILL.md"],
    model: "sonnet",
    charter: "Maps attack surface, entry points and trust boundaries; produces a caveman target map.",
  },
  {
    id: "cybersec:redteam-exploit",
    team: "red",
    role: "Exploit Engineer",
    agentFile: ".claude/agents/cybersec/redteam-exploit.agent.md",
    skills: [".claude/skills/redteam-attack/SKILL.md"],
    model: "opus",
    charter: "Builds and runs PoC exploits in the lab/sandbox only; proves impact, then hands off to blue.",
  },

  // ---- BLUE TEAM ------------------------------------------------------------
  {
    id: "cybersec:blueteam-coordinator",
    team: "blue",
    role: "Blue Team Lead",
    agentFile: ".claude/agents/cybersec/blueteam-coordinator.agent.md",
    skills: [".claude/skills/blueteam-defense/SKILL.md", ".claude/skills/cybersec-audit/SKILL.md"],
    model: "opus",
    charter: "Owns defensive posture, prioritizes findings, assigns hardening and detection work.",
  },
  {
    id: "cybersec:blueteam-hardening",
    team: "blue",
    role: "Hardening Engineer",
    agentFile: ".claude/agents/cybersec/blueteam-hardening.agent.md",
    skills: [".claude/skills/blueteam-defense/SKILL.md"],
    model: "sonnet",
    charter: "Implements the secure pattern fix; verifies the exploit no longer reproduces.",
  },
  {
    id: "cybersec:blueteam-detect",
    team: "blue",
    role: "Detection Engineer",
    agentFile: ".claude/agents/cybersec/blueteam-detect.agent.md",
    skills: [".claude/skills/blueteam-defense/SKILL.md"],
    model: "sonnet",
    charter: "Writes detections/tests/alerts so the same class of attack is caught next time.",
  },
  {
    id: "cybersec:blueteam-incident",
    team: "blue",
    role: "Incident Responder",
    agentFile: ".claude/agents/cybersec/blueteam-incident.agent.md",
    skills: [".claude/skills/blueteam-defense/SKILL.md"],
    model: "sonnet",
    charter: "Triages confirmed compromise, contains, and writes the blameless postmortem.",
  },

  // ---- PURPLE TEAM ----------------------------------------------------------
  {
    id: "cybersec:purpleteam-coordinator",
    team: "purple",
    role: "Purple Team Lead / Loop Driver",
    agentFile: ".claude/agents/cybersec/purpleteam-coordinator.agent.md",
    skills: [".claude/skills/purple-loop/SKILL.md", ".claude/skills/cybersec-audit/SKILL.md"],
    model: "opus",
    charter: "Runs the cyclic red-vs-blue loop, captures learnings to Engram, raises the bar each cycle.",
  },
] as const;

export function agentsByTeam(team: Team): CyberAgent[] {
  return TEAM_REGISTRY.filter((a) => a.team === team);
}

export function agentById(id: string): CyberAgent | undefined {
  return TEAM_REGISTRY.find((a) => a.id === id);
}

/** All distinct SKILL.md paths + the mandatory contract, for prompt injection. */
export function skillBundleFor(id: string): string[] {
  const agent = agentById(id);
  if (!agent) return [CONTRACT];
  return [CONTRACT, ...agent.skills];
}

export const MINION_CONTRACT_FILE = CONTRACT;
