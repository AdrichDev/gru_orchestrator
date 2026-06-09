import { describe, it, expect } from "vitest";
import {
  scoreComplexity,
  scoreRisk,
  levelFromScore,
  resolveViability,
  inferSignalsFromPrompt,
  classifyTask,
} from "../classifier.js";

// ── scoreComplexity ────────────────────────────────────────────────────────────

describe("scoreComplexity", () => {
  it("1 file (default) → score 0", () => {
    expect(scoreComplexity({ filesAffected: 1 })).toBe(0);
  });

  it("no signals (empty) → score 0", () => {
    expect(scoreComplexity({})).toBe(0);
  });

  it("2 files → score 1", () => {
    expect(scoreComplexity({ filesAffected: 2 })).toBe(1);
  });

  it("3 files → score 1", () => {
    expect(scoreComplexity({ filesAffected: 3 })).toBe(1);
  });

  it("4 files → score 2", () => {
    expect(scoreComplexity({ filesAffected: 4 })).toBe(2);
  });

  it("10 files → score 2 (same as 4+)", () => {
    expect(scoreComplexity({ filesAffected: 10 })).toBe(2);
  });

  it("2 domains → score includes +2", () => {
    expect(scoreComplexity({ domainsCrossed: 2 })).toBe(2);
  });

  it("1 domain → no bonus", () => {
    expect(scoreComplexity({ domainsCrossed: 1 })).toBe(0);
  });

  it("requiresNewArchitecture → +2", () => {
    expect(scoreComplexity({ requiresNewArchitecture: true })).toBe(2);
  });

  it("unknownLibrary → +1", () => {
    expect(scoreComplexity({ unknownLibrary: true })).toBe(1);
  });

  it("newExternalDependency → +1", () => {
    expect(scoreComplexity({ newExternalDependency: true })).toBe(1);
  });

  it("4 files + 2 domains + new arch → 2+2+2 = 6", () => {
    expect(scoreComplexity({
      filesAffected: 4,
      domainsCrossed: 2,
      requiresNewArchitecture: true,
    })).toBe(6);
  });

  it("4 files + unknown lib + new dep → 2+1+1 = 4", () => {
    expect(scoreComplexity({
      filesAffected: 4,
      unknownLibrary: true,
      newExternalDependency: true,
    })).toBe(4);
  });
});

// ── scoreRisk ─────────────────────────────────────────────────────────────────

describe("scoreRisk", () => {
  it("no signals → 0", () => {
    expect(scoreRisk({})).toBe(0);
  });

  it("isIrreversible → 3", () => {
    expect(scoreRisk({ isIrreversible: true })).toBe(3);
  });

  it("touchesProduction → 3", () => {
    expect(scoreRisk({ touchesProduction: true })).toBe(3);
  });

  it("touchesSecurityOrAuth → 3", () => {
    expect(scoreRisk({ touchesSecurityOrAuth: true })).toBe(3);
  });

  it("generatesFinancialCost → 2", () => {
    expect(scoreRisk({ generatesFinancialCost: true })).toBe(2);
  });

  it("touchesPersistentData → 2", () => {
    expect(scoreRisk({ touchesPersistentData: true })).toBe(2);
  });

  it("touchesMainBranch → 2", () => {
    expect(scoreRisk({ touchesMainBranch: true })).toBe(2);
  });

  it("production + security → 3+3 = 6", () => {
    expect(scoreRisk({ touchesProduction: true, touchesSecurityOrAuth: true })).toBe(6);
  });

  it("all risk signals → 3+3+3+2+2+2 = 15", () => {
    expect(scoreRisk({
      isIrreversible: true,
      touchesProduction: true,
      touchesSecurityOrAuth: true,
      generatesFinancialCost: true,
      touchesPersistentData: true,
      touchesMainBranch: true,
    })).toBe(15);
  });
});

// ── levelFromScore ────────────────────────────────────────────────────────────

describe("levelFromScore", () => {
  it("0 → level 0 (Trivial)", () => {
    expect(levelFromScore(0)).toBe(0);
  });

  it("1 → level 1 (Small)", () => {
    expect(levelFromScore(1)).toBe(1);
  });

  it("2 → level 1 (Small boundary)", () => {
    expect(levelFromScore(2)).toBe(1);
  });

  it("3 → level 2 (Medium)", () => {
    expect(levelFromScore(3)).toBe(2);
  });

  it("4 → level 2 (Medium boundary)", () => {
    expect(levelFromScore(4)).toBe(2);
  });

  it("5 → level 3 (Large)", () => {
    expect(levelFromScore(5)).toBe(3);
  });

  it("7 → level 3 (Large boundary)", () => {
    expect(levelFromScore(7)).toBe(3);
  });

  it("8 → level 4 (Critical)", () => {
    expect(levelFromScore(8)).toBe(4);
  });

  it("100 → level 4 (Critical, very high)", () => {
    expect(levelFromScore(100)).toBe(4);
  });
});

// ── resolveViability ──────────────────────────────────────────────────────────

describe("resolveViability", () => {
  it("no signals → ready", () => {
    expect(resolveViability({}, 0)).toBe("ready");
  });

  it("missingCapability → blocked (overrides all)", () => {
    expect(resolveViability({ missingCapability: "harness-subagents" }, 10)).toBe("blocked");
  });

  it("touchesProduction → needs_approval", () => {
    expect(resolveViability({ touchesProduction: true }, 3)).toBe("needs_approval");
  });

  it("touchesSecurityOrAuth → needs_approval", () => {
    expect(resolveViability({ touchesSecurityOrAuth: true }, 3)).toBe("needs_approval");
  });

  it("isIrreversible → needs_approval", () => {
    expect(resolveViability({ isIrreversible: true }, 3)).toBe("needs_approval");
  });

  it("touchesProduction + isIrreversible → needs_approval", () => {
    expect(resolveViability({ touchesProduction: true, isIrreversible: true }, 6)).toBe("needs_approval");
  });

  it("touchesMainBranch → needs_approval (violates main branch policy)", () => {
    expect(resolveViability({ touchesMainBranch: true }, 2)).toBe("needs_approval");
  });

  it("generatesFinancialCost → needs_approval (requires budget approval)", () => {
    expect(resolveViability({ generatesFinancialCost: true }, 2)).toBe("needs_approval");
  });
});

// ── inferSignalsFromPrompt ────────────────────────────────────────────────────

describe("inferSignalsFromPrompt", () => {
  it("'deploy to production' → touchesProduction", () => {
    expect(inferSignalsFromPrompt("deploy to production").touchesProduction).toBe(true);
  });

  it("'release v2.0' → touchesProduction (release keyword)", () => {
    expect(inferSignalsFromPrompt("release v2.0 to staging").touchesProduction).toBe(true);
  });

  it("'fix auth token refresh' → touchesSecurityOrAuth", () => {
    expect(inferSignalsFromPrompt("fix auth token refresh").touchesSecurityOrAuth).toBe(true);
  });

  it("'patch CVE-2024-1234' → touchesSecurityOrAuth", () => {
    expect(inferSignalsFromPrompt("patch CVE-2024-1234").touchesSecurityOrAuth).toBe(true);
  });

  it("'delete all users' → isIrreversible", () => {
    expect(inferSignalsFromPrompt("delete all users").isIrreversible).toBe(true);
  });

  it("'drop table orders' → isIrreversible", () => {
    expect(inferSignalsFromPrompt("drop table orders").isIrreversible).toBe(true);
  });

  it("'migrate database schema' → isIrreversible + touchesPersistentData", () => {
    const s = inferSignalsFromPrompt("migrate database schema");
    expect(s.isIrreversible).toBe(true);
    expect(s.touchesPersistentData).toBe(true);
  });

  it("'push to main branch' → touchesMainBranch", () => {
    expect(inferSignalsFromPrompt("push to main branch").touchesMainBranch).toBe(true);
  });

  it("'refactor auth module' → touchesSecurityOrAuth only (refactor does not imply new architecture)", () => {
    const s = inferSignalsFromPrompt("refactor auth module");
    expect(s.requiresNewArchitecture).toBeFalsy();
    expect(s.touchesSecurityOrAuth).toBe(true);
  });

  it("'add comment to function' → all signals absent", () => {
    const s = inferSignalsFromPrompt("add comment to function");
    expect(s.touchesProduction).toBeFalsy();
    expect(s.touchesSecurityOrAuth).toBeFalsy();
    expect(s.isIrreversible).toBeFalsy();
    expect(s.touchesPersistentData).toBeFalsy();
    expect(s.touchesMainBranch).toBeFalsy();
    expect(s.requiresNewArchitecture).toBeFalsy();
  });

  it("'fix typo in README' → all signals absent", () => {
    const s = inferSignalsFromPrompt("fix typo in README");
    expect(s.touchesProduction).toBeFalsy();
    expect(s.isIrreversible).toBeFalsy();
  });
});

// ── classifyTask ──────────────────────────────────────────────────────────────

describe("classifyTask", () => {
  it("trivial: no signals → level 0, ready, no gates", () => {
    const r = classifyTask("add comment");
    expect(r.level).toBe(0);
    expect(r.levelName).toBe("Trivial");
    expect(r.viability).toBe("ready");
    expect(r.requiresDevilsAdvocate).toBe(false);
    expect(r.requiresHumanApproval).toBe(false);
    expect(r.totalScore).toBe(0);
  });

  it("small: 2 files → level 1, no devil", () => {
    const r = classifyTask("update controller", { filesAffected: 2 });
    expect(r.level).toBe(1);
    expect(r.complexityScore).toBe(1);
    expect(r.requiresDevilsAdvocate).toBe(false);
  });

  it("medium: 3 files + 2 domains → totalScore=3, level 2, devil required", () => {
    const r = classifyTask("cross-domain update", { filesAffected: 3, domainsCrossed: 2 });
    expect(r.complexityScore).toBe(3);
    expect(r.level).toBe(2);
    expect(r.requiresDevilsAdvocate).toBe(true);
    expect(r.requiresHumanApproval).toBe(false);
  });

  it("critical: 4 files + prod + security + irreversible → level 4, needs_approval, human required", () => {
    const r = classifyTask("remove prod credentials", {
      filesAffected: 4,
      touchesProduction: true,
      touchesSecurityOrAuth: true,
      isIrreversible: true,
    });
    expect(r.level).toBe(4);
    expect(r.viability).toBe("needs_approval");
    expect(r.requiresDevilsAdvocate).toBe(true);
    expect(r.requiresHumanApproval).toBe(true);
    expect(r.suggestedMinions).toContain("minion-security");
    expect(r.suggestedMinions).toContain("minion-memory");
  });

  it("blocked: missingCapability → viability blocked, blockedReason set", () => {
    const r = classifyTask("spawn subagent", { missingCapability: "harness-subagents" });
    expect(r.viability).toBe("blocked");
    expect(r.blockedReason).toContain("harness-subagents");
  });

  it("prompt inference merges with explicit signals (explicit wins on conflict)", () => {
    // "deploy" infers touchesProduction=true, but explicit overrides to false
    const r = classifyTask("deploy to staging", { touchesProduction: false });
    // explicit false overrides inferred true
    expect(r.signals.touchesProduction).toBe(false);
    expect(r.viability).toBe("ready");
  });

  it("production prompt alone → inferred viability needs_approval", () => {
    const r = classifyTask("deploy to production");
    expect(r.viability).toBe("needs_approval");
    expect(r.inferredSignals.touchesProduction).toBe(true);
  });

  it("level 2 includes devil but not security minion", () => {
    const r = classifyTask("refactor routing", { filesAffected: 3, domainsCrossed: 2 });
    expect(r.suggestedMinions).toContain("minion-devil");
    expect(r.suggestedMinions).not.toContain("minion-security");
  });

  it("level 4 includes all minions from lower levels", () => {
    const r = classifyTask("overhaul", {
      filesAffected: 4,
      domainsCrossed: 2,
      requiresNewArchitecture: true,
      isIrreversible: true,
      touchesProduction: true,
    });
    expect(r.level).toBe(4);
    expect(r.suggestedMinions).toContain("minion-filesystem");
    expect(r.suggestedMinions).toContain("minion-architect");
    expect(r.suggestedMinions).toContain("minion-builder");
    expect(r.suggestedMinions).toContain("minion-reviewer");
    expect(r.suggestedMinions).toContain("minion-tester");
    expect(r.suggestedMinions).toContain("minion-security");
    expect(r.suggestedMinions).toContain("minion-memory");
  });
});
