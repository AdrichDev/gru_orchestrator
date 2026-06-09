import test from "node:test";
import assert from "node:assert/strict";
import { reviewDelegation } from "../packages/skills/src/personas/devils-advocate/index.js";
import type { ProviderAvailability, RoutingDecision } from "../packages/shared/src/ports/provider.js";

const decision: RoutingDecision = {
  provider: "awesomeCopilot",
  personas: [],
  confidence: 100,
  reasons: [],
  fallbacks: []
};

test("Devil bloquea Awesome Copilot como executor de agentes", () => {
  const availability: ProviderAvailability = {
    providerId: "awesomeCopilot",
    available: true,
    statusLabel: "AWESOME_COPILOT_CATALOG_READY",
    capabilities: ["catalog.search"],
    operationCallable: true,
    completionVerified: false
  };
  const finding = reviewDelegation({
    prompt: "ejecuta un agente security review",
    providerId: "awesomeCopilot",
    decision,
    availability
  });

  assert.equal(finding.blocked, true);
  assert.match(finding.reason ?? "", /catálogo|catalog/i);
});

test("Devil permite Awesome Copilot para buscar skills", () => {
  const availability: ProviderAvailability = {
    providerId: "awesomeCopilot",
    available: true,
    statusLabel: "AWESOME_COPILOT_CATALOG_READY",
    capabilities: ["catalog.search"],
    operationCallable: true
  };
  const finding = reviewDelegation({
    prompt: "skill.search security review",
    providerId: "awesomeCopilot",
    decision,
    availability
  });

  assert.equal(finding.blocked, false);
});
