# Apply Progress — Gru Provider Delegation Harness

## Fase 0 — Artefactos OpenSpec ✅
10 artefactos creados en `openspec/changes/gru-provider-delegation-harness/`.

## Fase 1 — Contratos + wrappers + registry + tests ✅

| Archivo | Estado |
|---------|--------|
| `packages/shared/src/ports/delegation.ts` | ✅ creado |
| `packages/shared/src/ports/index.ts` | ✅ export añadido |
| `packages/kernel/src/delegates/capabilities.ts` | ✅ |
| `packages/kernel/src/delegates/base.ts` | ✅ (Simple+Agentic façades, helpers) |
| `packages/kernel/src/delegates/awesome-copilot.ts` | ✅ (refs portables) |
| `packages/kernel/src/delegates/context7.ts` | ✅ (PLANNED/UNAVAILABLE) |
| `packages/kernel/src/delegates/registry.ts` | ✅ |
| `packages/kernel/src/delegates/index.ts` | ✅ (`createDelegationRegistry`) |
| `packages/kernel/src/delegates/__tests__/delegates.test.ts` | ✅ (24 tests) |

## Sin tocar (intactos)
`provider.ts` (`GruProvider`/`ProviderId`), `task-router`, `orchestrator`,
`adapters/ruflo.ts` (reusado vía `AgenticProviderDelegate`, sin editar).

## Fase 2+ — no iniciada (fuera de alcance)
CapabilityResolver · DelegationPlanner · ContextCollector · invoker ·
result-collector · DelegationOrchestrator · CLI `--delegate` · Context7 MCP ·
Engram real.
