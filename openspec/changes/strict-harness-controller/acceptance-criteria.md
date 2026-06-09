# Acceptance Criteria: Strict Harness Controller

## AC1 — Type compatibility

```typescript
import type { GateResult, GateOptions } from "@gru/shared";
import { StrictHarnessController } from ".../strict-harness-controller.js";
```
Compila sin error.

## AC2 — Gate trivial

```typescript
const ctrl = new StrictHarnessController(claudeAdapter);
const r = await ctrl.gate("add comment");
r.allowed === true
r.blockers.length === 0
r.classification.level === 0
```

## AC3 — Gate blocked por harness unavailable

```typescript
const ctrl = new StrictHarnessController(unavailableAdapter);
const r = await ctrl.gate("any task");
r.allowed === false
r.blockers.some(b => b.includes("BLOCKED"))
r.classification.viability === "blocked"
```

## AC4 — Gate con needs_approval

```typescript
const ctrl = new StrictHarnessController(claudeAdapter);
const r1 = await ctrl.gate("deploy to prod", { touchesProduction: true });
r1.allowed === false
r1.blockers.some(b => b.includes("NEEDS_APPROVAL"))

const r2 = await ctrl.gate("deploy to prod", { touchesProduction: true }, { forceApproval: true });
r2.allowed === true
r2.blockers.length === 0
```

## AC5 — Gate capability check

```typescript
// Harness without native-subagents
const ctrl = new StrictHarnessController(limitedAdapter);
// Task that classifies to level 3
const r = await ctrl.gate("cross-domain refactor", {
  filesAffected: 4, domainsCrossed: 2, requiresNewArchitecture: true,
});
r.allowed === false
r.classification.signals.missingCapability === "native-subagents"
```

## AC6 — Tests reales

`pnpm test` verde. Si se elimina el harness check, R1a falla con assertion error.
