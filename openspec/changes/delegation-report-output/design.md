# Design: Delegation Report Output

## Arquitectura

```
packages/
  shared/src/ports/
    report.ts               ← NEW: DevilsFinding, DelegationReport types
    index.ts                ← MODIFIED: export report.ts

  kernel/src/task-router/
    report-builder.ts       ← NEW: buildDelegationReport(), deriveDevilsFindings()
    __tests__/
      report-builder.test.ts ← NEW: tests reales
```

## Tipos (`shared/src/ports/report.ts`)

```typescript
import type { TaskClassification } from "./classification.js";
import type { DelegationProviderId, ProviderExecutionResult } from "./delegation.js";

export type DevilsSeverity = "blocker" | "warning" | "info";

export interface DevilsFinding {
  severity: DevilsSeverity;
  signal: string;
  message: string;
}

export interface DelegationReport {
  taskId: string;
  prompt: string;
  timestamp: string;
  classification: TaskClassification;
  resolvedDelegate?: DelegationProviderId;
  delegationBlocked: boolean;
  delegationBlockedReason?: string;
  execution?: ProviderExecutionResult;
  devilsFindings: DevilsFinding[];
  approved: boolean;
  blockers: string[];
}
```

## Implementación (`kernel/src/task-router/report-builder.ts`)

```typescript
// DelegationResolved / DelegationBlocked son los tipos de delegates/resolver.ts
type Resolution = { blocked: false; delegateId: DelegationProviderId } | { blocked: true; reason: string };

export function buildDelegationReport(params: {
  taskId: string;
  prompt: string;
  classification: TaskClassification;
  resolution: Resolution;
  execution?: ProviderExecutionResult;
}): DelegationReport

export function deriveDevilsFindings(classification: TaskClassification): DevilsFinding[]
```

## Lógica de aprobación

```
approved = true
  UNLESS delegationBlocked → false + blocker "delegation:BLOCKED — {reason}"
  UNLESS execution?.status !== "COMPLETED" → false + blocker "execution:{status} — {error}"
  
blockers siempre incluye:
  - "classification:NEEDS_APPROVAL — human approval required" si viability === "needs_approval"
  (NEEDS_APPROVAL no pone approved=false — es informativo, la decisión real es del humano)
```

## Devil's findings automáticos (solo cuando level >= 2)

| Signal | Severity | Mensaje |
|--------|----------|---------|
| touchesSecurityOrAuth | blocker | Security/auth change — requires security audit |
| isIrreversible | blocker | Irreversible change — verify backup/recovery |
| touchesProduction | warning | Touches production — validate in staging first |
| touchesPersistentData | warning | Touches persistent data — migration must be reversible |
| generatesFinancialCost | warning | Generates financial cost — confirm budget approval |
| level >= 4 | info | Critical complexity — consider splitting |
