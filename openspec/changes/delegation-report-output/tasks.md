# Tasks: Delegation Report Output

## T1 — Tipos públicos

- [x] Crear `packages/shared/src/ports/report.ts`
  - `DevilsSeverity`, `DevilsFinding`, `DelegationReport`
- [x] Exportar desde `packages/shared/src/ports/index.ts`

## T2 — Implementación

- [x] Crear `packages/kernel/src/task-router/report-builder.ts`
  - `deriveDevilsFindings(classification): DevilsFinding[]`
  - `buildDelegationReport(params): DelegationReport`

## T3 — Tests reales

- [x] Crear `packages/kernel/src/task-router/__tests__/report-builder.test.ts`
  - R1: campos obligatorios + timestamp ISO
  - R2: delegación resuelta/bloqueada
  - R3: devil's findings por signal
  - R4: aprobación y blockers
  - R5: función pura (no lanza)

## T4 — Verificación final

- [x] `pnpm exec tsc --noEmit` — solo warning pre-existente de baseUrl, sin errores nuestros
- [x] `pnpm test` — **22/22 verdes**, sin regresión
