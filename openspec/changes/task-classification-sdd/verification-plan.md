# Verification Plan: Task Classification Service

## V1 — TypeScript completo

```bash
pnpm exec tsc --noEmit
```
Sin errores en `packages/shared/src/ports/classification.ts` ni en `packages/kernel/src/task-router/classifier.ts`.

## V2 — Tests unitarios pasan

```bash
pnpm test
```

Todos los tests en `classifier.test.ts` verdes. Sin regresión en `delegates.test.ts` ni `config.test.ts`.

## V3 — Tests fallan si la lógica es incorrecta

Verificar manualmente que si se comenta/elimina el cuerpo de `scoreComplexity`, los tests de T5 fallan con assertion error (no con error de compilación). Esto confirma que los tests son reales, no triviales.

## V4 — Contratos de spec satisfechos

| Req | Test | Verificación |
|-----|------|--------------|
| R1a filesAffected=1 → 0 | `scoreComplexity: 1 file → score 0` | valor exacto |
| R1b filesAffected=3 → 1 | `scoreComplexity: 3 files → score 1` | valor exacto |
| R1c filesAffected=4 → ≥2 | `scoreComplexity: 4 files → score 2` | valor exacto |
| R1d domainsCrossed=2 → +2 | `scoreComplexity: 2 domains adds 2` | suma exact |
| R1e newArchitecture → +2 | `scoreComplexity: new arch → 2` | valor exacto |
| R2a irreversible → ≥3 | `scoreRisk: irreversible → 3` | valor exacto |
| R2b prod+security → ≥6 | `scoreRisk: prod+security → 6` | valor exacto |
| R2c no signals → 0 | `scoreRisk: no signals → 0` | valor exacto |
| R3a total=0 → level 0 | `levelFromScore: 0 → 0` | exacto |
| R3b total=1 → level 1 | `levelFromScore: 1 → 1` | exacto |
| R3c total=3 → level 2 | `levelFromScore: 3 → 2` | exacto |
| R3d total=5 → level 3 | `levelFromScore: 5 → 3` | exacto |
| R3e total=8 → level 4 | `levelFromScore: 8 → 4` | exacto |
| R4a no signals → ready | `resolveViability: clean → ready` | exacto |
| R4b prod+irrev → needs_approval | `resolveViability: prod+irrev → needs_approval` | exacto |
| R4c missingCapability → blocked | `resolveViability: missing → blocked` | exacto |
| R4d security → needs_approval | `resolveViability: security → needs_approval` | exacto |
| R5a prod keyword → touchesProduction | `inferSignals: deploy → touchesProduction` | toBe(true) |
| R5b security keyword → touchesSecurity | `inferSignals: auth token → touchesSecurity` | toBe(true) |
| R5c delete keyword → isIrreversible | `inferSignals: delete → isIrreversible` | toBe(true) |
| R5d neutral → all false | `inferSignals: add comment → all false` | toBeFalsy |
| R6a trivial → level 0, ready | `classifyTask: trivial` | full object check |
| R6b medium → level≥2, devil | `classifyTask: medium` | level + requiresDevil |
| R6c critical → level 4, approval | `classifyTask: critical` | level + viability + human |
| R6d missingCapability → blocked | `classifyTask: missing` | viability + blockedReason |

## V5 — No regresiones

`pnpm test` pasa todos los tests pre-existentes en `delegates.test.ts` y `config.test.ts`.
