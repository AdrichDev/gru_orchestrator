# Tasks: Strict Harness Controller

## T1 — Tipos públicos

- [x] Crear `packages/shared/src/ports/controller.ts`
  - `GateOptions`, `GateResult`
- [x] Exportar desde `packages/shared/src/ports/index.ts`

## T2 — Implementación

- [x] Crear `packages/kernel/src/task-router/strict-harness-controller.ts`
  - `StrictHarnessController` con constructor injection de `HarnessAdapter`
  - `gate(prompt, signals?, opts?): Promise<GateResult>`

## T3 — Tests reales

- [x] Crear `packages/kernel/src/task-router/__tests__/strict-harness-controller.test.ts`
  - R1: harness unavailable → blocked
  - R2: trivial, harness ready → allowed
  - R3a: needs_approval sin force → blocked
  - R3b: needs_approval con forceApproval → allowed
  - R4a: nivel 3+, sin native-subagents → blocked
  - R4b: nivel 3+, con native-subagents → allowed
  - R4c: nivel 2, sin native-subagents → not affected
  - R5: GateResult incluye classification completa
  - R6: no lanza

## T4 — Verificación final

- [x] `pnpm exec tsc --noEmit` — solo warning pre-existente de baseUrl, sin errores nuestros
- [x] `pnpm test` — **22/22 verdes**, 227 total sin regresión
