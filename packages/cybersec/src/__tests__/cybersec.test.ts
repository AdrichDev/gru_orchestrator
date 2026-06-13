import { describe, it, expect } from "vitest";
import {
  classifyRisk,
  labelForScore,
  scoreRisk,
  escalationFor,
} from "../severity.js";
import {
  PATTERNS,
  patternsByComplexity,
  patternById,
  patternsByOwasp,
} from "../patterns.js";
import { TEAM_REGISTRY, agentsByTeam, skillBundleFor, MINION_CONTRACT_FILE } from "../teams.js";
import {
  initLoop,
  advance,
  recordExploit,
  recordHardening,
  closeCycle,
  isHardened,
} from "../loop.js";
import { engramKey, cavemanLine, mergeLearning, type LearningRecord } from "../learning.js";

describe("severity", () => {
  it("scores a remote, high-impact, unauth bug as critical", () => {
    const r = classifyRisk({ exploitability: 1, impact: 1, exposure: 1 });
    expect(r.score).toBe(10);
    expect(r.label).toBe("critical");
  });

  it("scores a low-impact, hard-to-reach bug low", () => {
    const r = classifyRisk({ exploitability: 0.1, impact: 0.1, exposure: 0 });
    expect(r.label === "low" || r.label === "informational").toBe(true);
  });

  it("clamps out-of-range inputs", () => {
    expect(scoreRisk({ exploitability: 9, impact: 9, exposure: 9 })).toBe(10);
  });

  it("maps boundaries deterministically", () => {
    expect(labelForScore(9)).toBe("critical");
    expect(labelForScore(7)).toBe("high");
    expect(labelForScore(4)).toBe("medium");
    expect(labelForScore(0)).toBe("informational");
  });

  it("escalates critical to gru level 4 + human approval", () => {
    const e = escalationFor("critical");
    expect(e.gruLevel).toBe(4);
    expect(e.humanApproval).toBe(true);
    expect(e.owner).toBe("purple");
  });
});

describe("patterns catalog", () => {
  it("covers all three complexity tiers", () => {
    expect(patternsByComplexity("simple").length).toBeGreaterThan(0);
    expect(patternsByComplexity("medium").length).toBeGreaterThan(0);
    expect(patternsByComplexity("complex").length).toBeGreaterThan(0);
  });

  it("has unique ids and required teaching fields", () => {
    const ids = PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PATTERNS) {
      expect(p.cwe).toMatch(/^CWE-\d+$/);
      expect(p.owasp).toMatch(/^A\d{2}:2021/);
      expect(p.example.vulnerable).toBeTruthy();
      expect(p.example.secure).toBeTruthy();
      expect(p.example.vulnerable).not.toBe(p.example.secure);
    }
  });

  it("looks up by id and owasp prefix", () => {
    expect(patternById("sql-injection")?.cwe).toBe("CWE-89");
    expect(patternsByOwasp("A03").length).toBeGreaterThanOrEqual(2);
  });
});

describe("team registry", () => {
  it("has red, blue and purple agents", () => {
    expect(agentsByTeam("red").length).toBeGreaterThanOrEqual(3);
    expect(agentsByTeam("blue").length).toBeGreaterThanOrEqual(4);
    expect(agentsByTeam("purple").length).toBeGreaterThanOrEqual(1);
  });

  it("always injects the minion contract first in a skill bundle", () => {
    const bundle = skillBundleFor("cybersec:redteam-exploit");
    expect(bundle[0]).toBe(MINION_CONTRACT_FILE);
    expect(bundle.length).toBeGreaterThan(1);
  });

  it("every agent references its agent file and at least one skill", () => {
    for (const a of TEAM_REGISTRY) {
      expect(a.agentFile).toContain(".claude/agents/cybersec/");
      expect(a.skills.length).toBeGreaterThan(0);
    }
  });
});

describe("purple loop", () => {
  it("walks the full phase order across a cycle", () => {
    let s = initLoop("simple");
    const seen = [s.phase];
    for (let i = 0; i < 7; i++) {
      s = advance(s);
      seen.push(s.phase);
    }
    expect(seen).toEqual([
      "recon",
      "exploit",
      "assess",
      "harden",
      "detect",
      "reaudit",
      "learn",
      "recon",
    ]);
    expect(s.cycle).toBe(1);
  });

  it("keeps grinding the tier while red breaches", () => {
    let s = initLoop("simple");
    s = recordExploit(s, [{ patternId: "sql-injection", breached: true }]);
    s = closeCycle(s);
    expect(s.difficulty).toBe("simple");
    expect(s.cleanStreak).toBe(0);
    expect(s.open).toContain("sql-injection");
  });

  it("escalates difficulty after a clean streak, then reaches hardened at top tier", () => {
    let s = initLoop("simple");
    // breach then fix so open is empty
    s = recordExploit(s, [{ patternId: "secrets-in-source", breached: true }]);
    s = recordHardening(s, ["secrets-in-source"]);
    expect(s.open).toHaveLength(0);
    // two clean cycles escalate simple -> medium
    s = closeCycle(s); // streak 1
    s = closeCycle(s); // escalate
    expect(s.difficulty).toBe("medium");
    // medium -> complex
    s = closeCycle(s);
    s = closeCycle(s);
    expect(s.difficulty).toBe("complex");
    // complex clean streak -> hardened
    s = closeCycle(s);
    s = closeCycle(s);
    expect(isHardened(s)).toBe(true);
  });
});

describe("learning", () => {
  const rec: LearningRecord = {
    kind: "defense",
    patternId: "sql-injection",
    team: "blue",
    difficulty: "medium",
    severity: "critical",
    lesson: "Parameterize all queries; ORM raw calls reviewed.",
    cycle: 3,
    date: "2026-06-13",
  };

  it("builds an engram key in project convention", () => {
    expect(engramKey("gru-orchestrator", rec)).toBe(
      "project:gru-orchestrator:cybersec:defense:sql-injection",
    );
  });

  it("emits a caveman one-liner", () => {
    expect(cavemanLine(rec)).toContain("CYBERSEC DEFENSE");
    expect(cavemanLine(rec)).toContain("pattern=sql-injection");
  });

  it("merges newest-wins by key", () => {
    const older = { ...rec, lesson: "old", date: "2026-01-01" };
    const merged = mergeLearning("gru-orchestrator", [older], [rec]);
    expect(merged).toHaveLength(1);
    expect(merged[0].lesson).toBe("Parameterize all queries; ORM raw calls reviewed.");
  });
});
