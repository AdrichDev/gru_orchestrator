import { describe, expect, test } from "vitest";
import { reviewDelegation } from "../packages/skills/src/personas/devils-advocate/index.js";
import type { ProviderAvailability, RoutingDecision } from "../packages/shared/src/ports/provider.js";

const decision: RoutingDecision = {
  provider: "awesomeCopilot",
  personas: [],
  confidence: 100,
  reasons: [],
  fallbacks: [],
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function availableProvider(id = "engram"): ProviderAvailability {
  return { providerId: id as ProviderAvailability["providerId"], available: true, status: "ready" };
}

function decisionWithConf(conf: number): RoutingDecision {
  return { ...decision, provider: "engram", confidence: conf };
}

// ─── original tests (preserved exactly — backward compat) ─────────────────────

describe("devil's advocate — delegation review", () => {
  test("Devil bloquea Awesome Copilot como executor de agentes", () => {
    const availability: ProviderAvailability = {
      providerId: "awesomeCopilot",
      available: true,
      status: "ready",
      kind: "catalog",
    };
    const finding = reviewDelegation({
      prompt: "ejecuta un agente security review",
      providerId: "awesomeCopilot",
      decision,
      availability,
    });

    expect(finding.blocked).toBe(true);
    expect(finding.reason ?? "").toMatch(/catálogo|catalog/i);
  });

  test("Devil permite Awesome Copilot para buscar skills", () => {
    const availability: ProviderAvailability = {
      providerId: "awesomeCopilot",
      available: true,
      status: "ready",
      kind: "catalog",
    };
    const finding = reviewDelegation({
      prompt: "buscar skill de security review en el catalogo",
      providerId: "awesomeCopilot",
      decision,
      availability,
    });

    expect(finding.blocked).toBe(false);
  });

  test("Devil bloquea providers no disponibles — nunca se simula", () => {
    const availability: ProviderAvailability = {
      providerId: "gentlePi",
      available: false,
      status: "missing",
      reason: "binario no encontrado",
    };
    const finding = reviewDelegation({
      prompt: "usa swarm para esta tarea",
      providerId: "gentlePi",
      decision: { ...decision, provider: "gentlePi" },
      availability,
    });

    expect(finding.blocked).toBe(true);
    expect(finding.reason ?? "").toMatch(/no está disponible/i);
  });

  test("Devil avisa cuando la confianza del routing es baja", () => {
    const availability: ProviderAvailability = {
      providerId: "engram",
      available: true,
      status: "ready",
    };
    const finding = reviewDelegation({
      prompt: "haz algo",
      providerId: "engram",
      decision: { ...decision, provider: "engram", confidence: 10 },
      availability,
    });

    expect(finding.blocked).toBe(false);
    expect(finding.warnings.length).toBeGreaterThan(0);
  });
});

// ─── rigidity level tests ─────────────────────────────────────────────────────

describe("devil's advocate — rigidity levels", () => {

  // ── advisory ────────────────────────────────────────────────────────────────

  describe("advisory", () => {
    test("low confidence (5%) → no warning, no block", () => {
      const finding = reviewDelegation({
        prompt: "haz algo",
        providerId: "engram",
        decision: decisionWithConf(5),
        availability: availableProvider("engram"),
        rigidity: "advisory",
      });
      expect(finding.blocked).toBe(false);
      expect(finding.warnings).toHaveLength(0);
    });

    test("very low confidence (0%) → no warning, no block", () => {
      const finding = reviewDelegation({
        prompt: "haz algo",
        providerId: "engram",
        decision: decisionWithConf(0),
        availability: availableProvider("engram"),
        rigidity: "advisory",
      });
      expect(finding.blocked).toBe(false);
      expect(finding.warnings).toHaveLength(0);
    });

    test("high confidence (80%) → clean pass", () => {
      const finding = reviewDelegation({
        prompt: "haz algo",
        providerId: "engram",
        decision: decisionWithConf(80),
        availability: availableProvider("engram"),
        rigidity: "advisory",
      });
      expect(finding.blocked).toBe(false);
      expect(finding.warnings).toHaveLength(0);
    });
  });

  // ── strict (default) ────────────────────────────────────────────────────────

  describe("strict (default)", () => {
    test("confidence 20 (below minConfidence 30) → warning, no block", () => {
      const finding = reviewDelegation({
        prompt: "haz algo",
        providerId: "engram",
        decision: decisionWithConf(20),
        availability: availableProvider("engram"),
        rigidity: "strict",
      });
      expect(finding.blocked).toBe(false);
      expect(finding.warnings.length).toBeGreaterThan(0);
    });

    test("confidence 50 (above default minConfidence) → no warning, no block", () => {
      const finding = reviewDelegation({
        prompt: "haz algo",
        providerId: "engram",
        decision: decisionWithConf(50),
        availability: availableProvider("engram"),
        rigidity: "strict",
      });
      expect(finding.blocked).toBe(false);
      expect(finding.warnings).toHaveLength(0);
    });

    test("confidence exactly at minConfidence (30) → no warning", () => {
      const finding = reviewDelegation({
        prompt: "haz algo",
        providerId: "engram",
        decision: decisionWithConf(30),
        availability: availableProvider("engram"),
        rigidity: "strict",
      });
      expect(finding.blocked).toBe(false);
      expect(finding.warnings).toHaveLength(0);
    });
  });

  // ── absent rigidity defaults to strict (backward compat) ───────────────────

  describe("absent rigidity → strict behavior (backward compat)", () => {
    test("confidence 20 (no rigidity specified) → warning, no block (same as strict)", () => {
      const finding = reviewDelegation({
        prompt: "haz algo",
        providerId: "engram",
        decision: decisionWithConf(20),
        availability: availableProvider("engram"),
        // rigidity omitted → must behave as "strict"
      });
      expect(finding.blocked).toBe(false);
      expect(finding.warnings.length).toBeGreaterThan(0);
    });

    test("confidence 50 (no rigidity specified) → no warning, no block (same as strict)", () => {
      const finding = reviewDelegation({
        prompt: "haz algo",
        providerId: "engram",
        decision: decisionWithConf(50),
        availability: availableProvider("engram"),
        // rigidity omitted → must behave as "strict"
      });
      expect(finding.blocked).toBe(false);
      expect(finding.warnings).toHaveLength(0);
    });
  });

  // ── paranoid ────────────────────────────────────────────────────────────────

  describe("paranoid", () => {
    test("confidence 20 (below minConfidence 30) → BLOCKED", () => {
      const finding = reviewDelegation({
        prompt: "haz algo",
        providerId: "engram",
        decision: decisionWithConf(20),
        availability: availableProvider("engram"),
        rigidity: "paranoid",
      });
      expect(finding.blocked).toBe(true);
      expect(finding.reason).toBeDefined();
      expect(finding.reason ?? "").toMatch(/mínimo configurado/i);
    });

    test("confidence 50 (above minConf 30, below paranoid warn threshold 60) → warning, not blocked", () => {
      const finding = reviewDelegation({
        prompt: "haz algo",
        providerId: "engram",
        decision: decisionWithConf(50),
        availability: availableProvider("engram"),
        rigidity: "paranoid",
      });
      expect(finding.blocked).toBe(false);
      expect(finding.warnings.length).toBeGreaterThan(0);
    });

    test("confidence 70 (above paranoid warn threshold 60) → no warning, not blocked", () => {
      const finding = reviewDelegation({
        prompt: "haz algo",
        providerId: "engram",
        decision: decisionWithConf(70),
        availability: availableProvider("engram"),
        rigidity: "paranoid",
      });
      expect(finding.blocked).toBe(false);
      expect(finding.warnings).toHaveLength(0);
    });
  });

  // ── hard rules block at EVERY level ──────────────────────────────────────────

  describe("hard rules — always block regardless of rigidity level", () => {
    const levels = ["advisory", "strict", "paranoid"] as const;

    for (const level of levels) {
      test(`provider unavailable → blocked at level '${level}'`, () => {
        const finding = reviewDelegation({
          prompt: "haz algo",
          providerId: "gentlePi",
          decision: { ...decision, provider: "gentlePi", confidence: 100 },
          availability: { providerId: "gentlePi", available: false, status: "missing", reason: "not found" },
          rigidity: level,
        });
        expect(finding.blocked).toBe(true);
        expect(finding.reason ?? "").toMatch(/no está disponible/i);
      });

      test(`catalog-as-executor → blocked at level '${level}'`, () => {
        const finding = reviewDelegation({
          prompt: "ejecuta un agente con este catalogo",
          providerId: "awesomeCopilot",
          decision: { ...decision, provider: "awesomeCopilot", confidence: 100 },
          availability: { providerId: "awesomeCopilot", available: true, status: "ready", kind: "catalog" },
          rigidity: level,
        });
        expect(finding.blocked).toBe(true);
        expect(finding.reason ?? "").toMatch(/catálogo|catalog/i);
      });
    }
  });

  // ── custom minConfidence ─────────────────────────────────────────────────────

  describe("custom minConfidence", () => {
    test("strict with minConfidence 50: confidence 40 → warning", () => {
      const finding = reviewDelegation({
        prompt: "haz algo",
        providerId: "engram",
        decision: decisionWithConf(40),
        availability: availableProvider("engram"),
        rigidity: "strict",
        minConfidence: 50,
      });
      expect(finding.blocked).toBe(false);
      expect(finding.warnings.length).toBeGreaterThan(0);
    });

    test("strict with minConfidence 50: confidence 60 → no warning", () => {
      const finding = reviewDelegation({
        prompt: "haz algo",
        providerId: "engram",
        decision: decisionWithConf(60),
        availability: availableProvider("engram"),
        rigidity: "strict",
        minConfidence: 50,
      });
      expect(finding.blocked).toBe(false);
      expect(finding.warnings).toHaveLength(0);
    });

    test("paranoid with minConfidence 50: confidence 40 → BLOCKED", () => {
      const finding = reviewDelegation({
        prompt: "haz algo",
        providerId: "engram",
        decision: decisionWithConf(40),
        availability: availableProvider("engram"),
        rigidity: "paranoid",
        minConfidence: 50,
      });
      expect(finding.blocked).toBe(true);
    });
  });
});
