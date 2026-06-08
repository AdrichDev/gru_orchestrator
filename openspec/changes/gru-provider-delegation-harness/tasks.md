# Tasks — Gru Provider Delegation Harness

## Fase 0 — Artefactos OpenSpec  ✅
- [x] T0.1 proposal.md
- [x] T0.2 design.md
- [x] T0.3 specs/gru-provider-delegation-harness/spec.md
- [x] T0.4 tasks.md / verification-plan.md / acceptance-criteria.md
- [x] T0.5 provider-inventory.md (capacidades reales)
- [x] T0.6 apply-progress.md / verify-report.md / sync-report.md

## Fase 1 — Contratos + wrappers + registry + tests  ✅
- [x] T1.1 Port `packages/shared/src/ports/delegation.ts` + export en `index.ts`
- [x] T1.2 `delegates/capabilities.ts` (SPECS reales, allowlists, flagsFor)
- [x] T1.3 `delegates/base.ts` — `makeInvocationId`, `stripAbsolute`,
      `mapAvailabilityToDetection`, `assertOperation`, `wrapSyncRun`,
      `SimpleProviderDelegate`, `AgenticProviderDelegate`, `normalizeExecutionResult`
- [x] T1.4 `delegates/awesome-copilot.ts` (refs portables `awesome-copilot:<rel>`)
- [x] T1.5 `delegates/context7.ts` (PLANNED, siempre UNAVAILABLE)
- [x] T1.6 `delegates/registry.ts` (`DefaultDelegationRegistry`, sin duplicados/fallback)
- [x] T1.7 `delegates/index.ts` (`createDelegationRegistry()` sobre runtimes reales)
- [x] T1.8 Tests de contrato `delegates/__tests__/delegates.test.ts`
- [x] T1.9 `tsc --noEmit` limpio · `pnpm test` verde · sin regresión simple/agentic

## Gate Fase 1
- [x] `GruProvider` y `ProviderAdapter` intactos
- [x] Operación incompatible → `UNSUPPORTED` sin tocar runtime (test + spy)
- [x] `SUBMITTED`/`RUNNING` ≠ `COMPLETED`; `TIMEOUT` ≠ `FAILED` (test)
- [x] Context7/Engram fuera de `getAvailable()` (test)
- [x] Refs portables, sin rutas absolutas (test)

## Fase 2+ — FUTURA (fuera de alcance de este cambio)
- [ ] T2.1 CapabilityResolver (selección por capacidad)
- [ ] T2.2 DelegationPlanner (DAG con `dependsOn`)
- [ ] T2.3 ContextCollector (Gentleman/Context7/AwesomeCopilot/Engram)
- [ ] T2.4 provider-invoker + result-collector
- [ ] T2.5 DelegationOrchestrator (ejecuta el plan + supervisión + gates + trazabilidad)
- [ ] T2.6 CLI `--delegate`
- [ ] T2.7 Context7 MCP real · Engram store/retrieve real
