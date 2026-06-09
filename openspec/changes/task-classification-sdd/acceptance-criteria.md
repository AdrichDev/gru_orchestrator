# Acceptance Criteria: Task Classification Service

## AC1 — Tipos exportados

`import { TaskLevel, TaskViability, MinionRole, ClassificationSignals, TaskClassification } from "@gru/shared"` compila sin error.

## AC2 — Scoring exacto

```typescript
import { scoreComplexity, scoreRisk, levelFromScore } from ".../classifier.js";

scoreComplexity({ filesAffected: 4, domainsCrossed: 2, requiresNewArchitecture: true }) === 6
scoreRisk({ touchesProduction: true, touchesSecurityOrAuth: true }) === 6
scoreRisk({ isIrreversible: true, touchesProduction: true, touchesSecurityOrAuth: true,
            generatesFinancialCost: true, touchesPersistentData: true, touchesMainBranch: true }) === 15
levelFromScore(7) === 3
levelFromScore(8) === 4
```

## AC3 — Viabilidad correcta

```typescript
import { resolveViability } from ".../classifier.js";

resolveViability({}, 0) === "ready"
resolveViability({ missingCapability: "harness" }, 0) === "blocked"
resolveViability({ touchesSecurityOrAuth: true }, 3) === "needs_approval"
resolveViability({ touchesMainBranch: true }, 2) === "ready"  // no critical signal
```

## AC4 — Inferencia de prompt real

```typescript
import { inferSignalsFromPrompt } from ".../classifier.js";

inferSignalsFromPrompt("deploy to production").touchesProduction === true
inferSignalsFromPrompt("fix auth token").touchesSecurityOrAuth === true
inferSignalsFromPrompt("drop database table").isIrreversible === true
inferSignalsFromPrompt("add comment to function").touchesProduction === undefined/false
inferSignalsFromPrompt("add comment to function").isIrreversible === undefined/false
```

## AC5 — Clasificación completa

```typescript
import { classifyTask } from ".../classifier.js";

const trivial = classifyTask("add comment");
trivial.level === 0
trivial.viability === "ready"
trivial.requiresDevilsAdvocate === false
trivial.requiresHumanApproval === false

const critical = classifyTask("remove prod DB", {
  filesAffected: 4, touchesProduction: true, touchesSecurityOrAuth: true, isIrreversible: true
});
critical.level === 4
critical.viability === "needs_approval"
critical.requiresDevilsAdvocate === true
critical.requiresHumanApproval === true
critical.suggestedMinions.includes("minion-security")
```

## AC6 — Sin side effects

`classifyTask()` no hace I/O. No lanza excepciones para entradas válidas. Función pura.

## AC7 — Tests pasan y son reales

`pnpm test` verde. Si se borra el cuerpo de `scoreComplexity()`, el test suite falla con assertion errors.
