# Tasks: Task Classification Service

## T1 — Tipos públicos

- [x] Crear `packages/shared/src/ports/classification.ts`
  - `TaskLevel = 0 | 1 | 2 | 3 | 4`
  - `TaskViability = "ready" | "blocked" | "needs_approval" | "unsupported"`
  - `MinionRole` (10 valores)
  - `ClassificationSignals` interface
  - `TaskClassification` interface
- [x] Exportar desde `packages/shared/src/ports/index.ts`

## T2 — Scoring functions

- [x] Crear `packages/kernel/src/task-router/classifier.ts`
- [x] `scoreComplexity(signals): number` — tablas de filesAffected, domainsCrossed, flags
- [x] `scoreRisk(signals): number` — tablas de irreversibilidad, producción, seguridad
- [x] `levelFromScore(total): TaskLevel` — rangos 0/1-2/3-4/5-7/8+
- [x] `resolveViability(signals, riskScore): TaskViability` — missingCapability→blocked; crítico→needs_approval; else→ready

## T3 — Inferencia de prompt

- [x] `inferSignalsFromPrompt(prompt): Partial<ClassificationSignals>` — regex para 6 señales

## T4 — Clasificación completa

- [x] `classifyTask(prompt, signals?): TaskClassification` — merge inferred+explicit, calcula todos los campos

## T5 — Tests reales

- [x] Crear `packages/kernel/src/task-router/__tests__/classifier.test.ts` con vitest
- [x] Tests de `scoreComplexity`: valores exactos (no solo >0)
- [x] Tests de `scoreRisk`: valores exactos
- [x] Tests de `levelFromScore`: cada rango con boundary values
- [x] Tests de `resolveViability`: cada ruta (ready, blocked, needs_approval)
- [x] Tests de `inferSignalsFromPrompt`: positivos y negativos
- [x] Tests de `classifyTask`: escenarios trivial, medium, critical, blocked
- [x] Verificar todos los tests pasan con `pnpm test` — **59/59 verdes**

## T6 — Verificación final

- [x] `pnpm exec tsc --noEmit` — solo warning pre-existente de `baseUrl` deprecation, sin errores nuestros
- [x] `pnpm test` — 59 tests nuevos verdes, tests existentes sin regresión
