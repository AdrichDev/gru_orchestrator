# Tasks: MCP Delegation Repair

## Phase 1 — SDD artifacts

- [x] T1.1 Crear `proposal.md`
- [x] T1.2 Crear `spec.md`
- [x] T1.3 Crear `design.md`
- [x] T1.4 Crear `tasks.md`
- [x] T1.5 Crear `verification-plan.md`
- [x] T1.6 Crear `acceptance-criteria.md`

## Phase 2 — Tests de configuración (R1 + R2)

- [ ] T2.1 Crear `packages/kernel/src/orchestrator/__tests__/config.test.ts`
  - Test: `.mcp.json` claude-flow usa `pnpm dlx`, no `npx`
  - Test: `.claude/settings.json` sin wildcard `mcp__*:*`
  - Test: cada rule MCP en allow es `mcp__<server>__<tool>` (sin glob al final)

## Phase 3 — Context7Delegate real (R3)

- [ ] T3.1 Actualizar `packages/kernel/src/delegates/context7.ts`
  - Añadir `Context7Config` interface y `readContext7Config()` function
  - Añadir `probeContext7(config)` function (spawn + JSON-RPC initialize + timeout 3s)
  - Cambiar constructor para inyectar `_readConfig` y `_probe` (defaults a las funciones reales)
  - Reescribir `detect()` con los tres estados: PLANNED / READY-UNAVAILABLE / READY-AVAILABLE
  - Reescribir `execute()` para llamar detect() antes de intentar runtime

- [ ] T3.2 Actualizar `packages/kernel/src/delegates/__tests__/delegates.test.ts`
  - Reemplazar tests "stays UNAVAILABLE" con nuevos tests de detección por estado
  - Actualizar test de registry que usaba `new Context7Delegate()` sin args
  - Añadir test: no fabrica output cuando UNAVAILABLE
  - Añadir test: UNSUPPORTED sin llamar proceso

## Phase 4 — Delegation resolver (R4)

- [ ] T4.1 Añadir `resolveDelegate()` en `packages/kernel/src/delegates/index.ts`
  - Exportar `DelegationResolved` y `DelegationBlocked` interfaces
  - Implementar `resolveDelegate(operation, registry?)` con lógica de selección por allowlist
  - Sin fallback silencioso: si ningún delegate soporta → `blocked: true`

- [ ] T4.2 Actualizar `packages/kernel/src/orchestrator/index.ts`
  - Añadir `operation?: string` a `orchestrateAgenticTask` firma
  - Importar `createDelegationRegistry`, `resolveDelegate`, `ProviderExecutionRequest`
  - Implementar early-return BLOCKED cuando `resolveDelegate` bloquea
  - Implementar path no-ruflo para delegates directos
  - Sin cambios al path sin `operation` (backward compat)

## Phase 5 — Verificación

- [ ] T5.1 `pnpm exec tsc --noEmit` — 0 errores
- [ ] T5.2 `pnpm test` — todos los tests pasan
- [ ] T5.3 `pnpm gru status --strict` — sin errores
- [ ] T5.4 Prueba manual: `pnpm gru "test agentic delegation"` — pipeline simple sigue funcionando
- [ ] T5.5 Prueba manual: delegation con operación no soportada devuelve BLOCKED con causa
