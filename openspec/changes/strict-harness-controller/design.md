# Design: Strict Harness Controller

## Arquitectura

```
packages/
  shared/src/ports/
    controller.ts              ← NEW: GateOptions, GateResult
    index.ts                   ← MODIFIED: export controller.ts

  kernel/src/task-router/
    strict-harness-controller.ts  ← NEW: StrictHarnessController
    __tests__/
      strict-harness-controller.test.ts  ← NEW: tests con injected adapters
```

## Tipos (`shared/src/ports/controller.ts`)

```typescript
import type { TaskClassification } from "./classification.js";

export interface GateOptions {
  forceApproval?: boolean;
}

export interface GateResult {
  allowed: boolean;
  classification: TaskClassification;
  blockers: string[];
}
```

## Implementación

```typescript
export class StrictHarnessController {
  constructor(private readonly _harness: HarnessAdapter) {}

  async gate(
    prompt: string,
    signals: ClassificationSignals = {},
    opts: GateOptions = {}
  ): Promise<GateResult> {
    const avail = await this._harness.checkAvailability();
    const enriched = { ...signals };

    // Harness not ready → can't operate
    if (avail.status !== "ready") {
      enriched.missingCapability = "harness-unavailable";
    }

    // Pre-classify to determine level
    const preClass = classifyTask(prompt, enriched);

    // Level >= 3 needs native-subagents
    if (preClass.level >= 3 && !enriched.missingCapability) {
      if (!this._harness.supports("native-subagents")) {
        enriched.missingCapability = "native-subagents";
      }
    }

    // Final classification with enriched signals
    const classification = classifyTask(prompt, enriched);

    const blockers: string[] = [];
    if (classification.viability === "blocked") {
      blockers.push(`gate:BLOCKED — ${classification.blockedReason ?? "missing capability"}`);
    }
    if (classification.viability === "needs_approval" && !opts.forceApproval) {
      blockers.push("gate:NEEDS_APPROVAL — human approval required (forceApproval: true to proceed)");
    }

    return { allowed: blockers.length === 0, classification, blockers };
  }
}
```

## Decision: doble classify

Se hace `classifyTask()` dos veces intencionalmente:
1. Pre-classify con harness check → determinar nivel
2. Final classify con capabilities enriquecidas → resultado final

Ambas son funciones puras sin I/O. El costo es despreciable.

## Tests (deben FALLAR si gate logic es incorrecta)

```typescript
// Falla si harness unavailable no bloquea:
const ctrl = new StrictHarnessController(unavailableHarness);
expect((await ctrl.gate("x")).allowed).toBe(false); // si gate siempre devuelve allowed=true → falla

// Falla si forceApproval no desbloquea:
const ctrl2 = new StrictHarnessController(readyHarness);
const r1 = await ctrl2.gate("deploy", { touchesProduction: true });
expect(r1.allowed).toBe(false); // sin fuerza → bloqueado
const r2 = await ctrl2.gate("deploy", { touchesProduction: true }, { forceApproval: true });
expect(r2.allowed).toBe(true); // con fuerza → permitido
// Si se invierte la lógica de forceApproval, uno de los dos falla
```
