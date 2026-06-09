# Verification Plan: Strict Harness Controller

## V1 — TypeScript

```bash
pnpm exec tsc --noEmit
```
`GateResult`, `GateOptions`, `StrictHarnessController` compilan sin error.

## V2 — Tests pasan

```bash
pnpm exec vitest run packages/kernel/src/task-router/__tests__/strict-harness-controller.test.ts
```
Todos verdes.

## V3 — Tests fallan sin lógica

Si se elimina el check de `avail.status !== "ready"`:
- R1a falla (harness unavailable → debería blocked).

Si se elimina el check de `needs_approval && !forceApproval`:
- R3a falla (debería blocked sin force).
- O R3b falla (debería allowed con force, según cuál lógica se rompe).

Si se elimina el capability check para nivel >= 3:
- R4a falla (sin native-subagents debería blocked).

## V4 — Contratos

| Req | Test | Check |
|-----|------|-------|
| R1a harness unavail | `unavailable harness → blocked` | allowed false |
| R2a trivial ready | `trivial task allowed` | allowed true |
| R3a needs_approval no force | `needs_approval no force` | allowed false + NEEDS_APPROVAL |
| R3b needs_approval force | `needs_approval force` | allowed true |
| R4a level3+ no native | `level3 no native-subagents` | viability blocked |
| R4b level3+ with native | `level3 with native-subagents` | allowed true |
| R4c level2 no native | `level2 no native-subagents irrelevant` | allowed true |

## V5 — Sin regresión

`pnpm test` — 205 tests previos sin cambio.
