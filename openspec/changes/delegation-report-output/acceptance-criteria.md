# Acceptance Criteria: Delegation Report Output

## AC1 — Tipos exportados

```typescript
import type { DevilsFinding, DelegationReport } from "@gru/shared";
```
Compila sin error.

## AC2 — Report completo

```typescript
import { buildDelegationReport } from ".../report-builder.js";

const report = buildDelegationReport({
  taskId: "t1",
  prompt: "add comment",
  classification: classifyTask("add comment"),
  resolution: { blocked: false, delegateId: "ecc", delegate: ... },
});
report.taskId === "t1"
report.delegationBlocked === false
report.approved === true
report.devilsFindings.length === 0  // level 0, devil not active
```

## AC3 — Devil's findings generados

```typescript
const classification = classifyTask("delete prod DB", {
  filesAffected: 4,
  touchesProduction: true,
  isIrreversible: true,
  touchesSecurityOrAuth: true,
});
const findings = deriveDevilsFindings(classification);
// security → blocker
findings.some(f => f.signal === "touchesSecurityOrAuth" && f.severity === "blocker")
// irreversible → blocker
findings.some(f => f.signal === "isIrreversible" && f.severity === "blocker")
// production → warning
findings.some(f => f.signal === "touchesProduction" && f.severity === "warning")
```

## AC4 — Blocker propagation

```typescript
const blockedReport = buildDelegationReport({
  ...
  resolution: { blocked: true, reason: "no delegate supports op" },
});
blockedReport.approved === false
blockedReport.blockers.some(b => b.includes("BLOCKED"))
```

## AC5 — Función pura

`buildDelegationReport` con cualquier input válido no lanza. `deriveDevilsFindings` con cualquier `TaskClassification` no lanza.

## AC6 — Tests reales

`pnpm test` verde. Si `deriveDevilsFindings` devuelve `[]` siempre, test R3b falla.
