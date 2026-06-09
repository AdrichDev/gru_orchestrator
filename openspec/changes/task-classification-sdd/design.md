# Design: Task Classification Service

## Arquitectura

```
packages/
  shared/src/ports/
    classification.ts      ← NEW: tipos públicos (ClassificationSignals, TaskClassification, MinionRole, etc.)
    index.ts               ← MODIFIED: export classification.ts

  kernel/src/task-router/
    classifier.ts          ← NEW: lógica de clasificación pura (sin I/O)
    index.ts               ← unchanged (routing existente no se toca)
    __tests__/
      classifier.test.ts   ← NEW: tests reales con vitest
```

## Tipos públicos (`shared/src/ports/classification.ts`)

```typescript
export type TaskLevel = 0 | 1 | 2 | 3 | 4;
export type TaskViability = "ready" | "blocked" | "needs_approval" | "unsupported";
export type MinionRole =
  | "minion-filesystem" | "minion-architect" | "minion-builder"
  | "minion-reviewer"  | "minion-tester"    | "minion-devil"
  | "minion-security"  | "minion-docs"      | "minion-mcp" | "minion-memory";

export interface ClassificationSignals {
  filesAffected?: number;
  domainsCrossed?: number;
  requiresNewArchitecture?: boolean;
  unknownLibrary?: boolean;
  newExternalDependency?: boolean;
  isIrreversible?: boolean;
  touchesProduction?: boolean;
  touchesSecurityOrAuth?: boolean;
  generatesFinancialCost?: boolean;
  touchesPersistentData?: boolean;
  touchesMainBranch?: boolean;
  missingCapability?: string;
}

export interface TaskClassification {
  complexityScore: number;
  riskScore: number;
  totalScore: number;
  level: TaskLevel;
  levelName: "Trivial" | "Small" | "Medium" | "Large" | "Critical";
  viability: TaskViability;
  blockedReason?: string;
  requiresDevilsAdvocate: boolean;
  requiresHumanApproval: boolean;
  suggestedMinions: MinionRole[];
  inferredSignals: Partial<ClassificationSignals>;
  signals: ClassificationSignals;
}
```

## Implementación (`kernel/src/task-router/classifier.ts`)

### Tablas de puntuación (de CLAUDE.md, codificadas)

**Complejidad:**
| Señal | Puntos |
|-------|--------|
| filesAffected = 1 | 0 |
| filesAffected = 2-3 | +1 |
| filesAffected >= 4 | +2 |
| domainsCrossed >= 2 | +2 |
| requiresNewArchitecture | +2 |
| unknownLibrary | +1 |
| newExternalDependency | +1 |

**Riesgo:**
| Señal | Puntos |
|-------|--------|
| isIrreversible | +3 |
| touchesProduction | +3 |
| touchesSecurityOrAuth | +3 |
| generatesFinancialCost | +2 |
| touchesPersistentData | +2 |
| touchesMainBranch | +2 |

**Nivel:**
| Total | Nivel | Nombre |
|-------|-------|--------|
| 0 | 0 | Trivial |
| 1-2 | 1 | Small |
| 3-4 | 2 | Medium |
| 5-7 | 3 | Large |
| >=8 | 4 | Critical |

### Viabilidad

```
missingCapability    → "blocked"
riskScore >= 3 AND (isIrreversible OR touchesProduction OR touchesSecurityOrAuth)
                     → "needs_approval"
otherwise            → "ready"
```

### Minions sugeridos por nivel

| Nivel | Minions requeridos |
|-------|-------------------|
| 0 | minion-builder |
| 1 | minion-filesystem, minion-builder |
| 2 | minion-filesystem, minion-architect, minion-builder, minion-devil |
| 3 | + minion-reviewer, minion-tester |
| 4 | + minion-security, minion-memory |

### Inferencia desde prompt

Regex conservadoras. Falso positivo más seguro que falso negativo.

| Señal inferida | Patrón |
|----------------|--------|
| touchesProduction | `/\bprod(uction)?\b|deploy|release|publish/i` |
| touchesSecurityOrAuth | `/\bsecurity\b|\bauth\b|\bcve\b|\bcredential\b|\bsecret\b|\btoken\b/i` |
| isIrreversible | `/\bdelete\b|\bdrop\b|\bremove\b|\bmigrat/i` |
| touchesPersistentData | `/\bmigrat|\bdatabase\b|\bschema\b/i` |
| touchesMainBranch | `/\bmain\b|\bmaster\b/i` |
| requiresNewArchitecture | `/\bnew architecture\b|\bredesign\b|\brefactor\b/i` |

## Tests reales (criterio: deben FALLAR si la lógica es incorrecta)

Los tests usan vitest y afirman valores concretos — no solo "mayor que cero". Si se elimina el scoring, los assertions de score exacto fallan. Si se invierte la lógica de viability, el test de `needs_approval` falla.

Ejemplo de test que falla si scoring es removido:
```typescript
it("production + security = riskScore >= 6", () => {
  expect(scoreRisk({ touchesProduction: true, touchesSecurityOrAuth: true })).toBeGreaterThanOrEqual(6);
});
```

Ejemplo que falla si inferencia es eliminada:
```typescript
it("prompt 'deploy to production' → touchesProduction=true", () => {
  expect(inferSignalsFromPrompt("deploy to production").touchesProduction).toBe(true);
});
it("prompt 'add comment' → all false", () => {
  const s = inferSignalsFromPrompt("add comment to function");
  expect(s.touchesProduction).toBeFalsy();
  expect(s.touchesSecurityOrAuth).toBeFalsy();
  expect(s.isIrreversible).toBeFalsy();
});
```
