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
      providerId: "ruflo",
      available: false,
      status: "missing",
      reason: "binario no encontrado",
    };
    const finding = reviewDelegation({
      prompt: "usa swarm para esta tarea",
      providerId: "ruflo",
      decision: { ...decision, provider: "ruflo" },
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
