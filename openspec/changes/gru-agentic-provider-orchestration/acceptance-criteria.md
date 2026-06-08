# Acceptance Criteria: Gru Agentic Provider Orchestration

## AC1: Descubrimiento de agentes reales

- [ ] `RufloProviderAdapter.getCatalog().listAgents()` devuelve ≥1 `AgentDescriptor` cuando `D:\Adrian\10. IA\ruflo\.agents\skills\` existe
- [ ] Cada `AgentDescriptor` tiene `id`, `name`, `provider: "ruflo"`, `availability` definido
- [ ] `canWrite`, `canReview`, `canTest` asignados por heurística de `type` — no todos false para agentes con tipo reconocible
- [ ] Agente con SKILL.md inválido → `availability: "unavailable"`, no excepción no capturada
- [ ] `AwesomeCopilotProviderAdapter.getCatalog()` devuelve catálogo si `vendor/awesome-copilot/skills/` existe
- [ ] Límite de 50 agentes respetado en `findByPhase()` y `findByCapability()`

## AC2: Resolución sin autoaprobación

- [ ] `AgentResolver.resolve(task, "apply")` retorna `executor.id !== reviewer.id` en todos los casos
- [ ] `tester.provider === "ruflo"` cuando Ruflo disponible
- [ ] Si Ruflo no disponible: `resolve()` lanza error `CAPABILITY_UNSUPPORTED`, `recoverable: false`
- [ ] No hay camino que retorne `TaskAssignment` con `executor.id === reviewer.id`

## AC3: Ejecución supervisada en orden correcto

- [ ] Orden de ejecución: executor → reviewer → tester (siempre, no paralelo)
- [ ] Reviewer recibe `ExecutionResult`, no el prompt original
- [ ] Tester recibe `ExecutionResult` + `ReviewResult`
- [ ] Si `reviewer.approved === false` → plan se detiene, no ejecuta tester
- [ ] `PlanResult.blockers` populado desde `ReviewResult.blockers`

## AC4: Quality gates no negociables

- [ ] Gate `test-evidence`: ausencia de `TestEvidence` → `status: "blocked"` (no `"skipped"`, no `"passed"`)
- [ ] Gate `review-independence`: `executor.id === reviewer.id` → `status: "failed"`
- [ ] Gate `sdd-traceability`: faltan artefactos SDD → `status: "failed"`
- [ ] Gate `code-regression`: `regressions.length > 0` → `status: "failed"`
- [ ] Gate `security`: finding blocker sin fix → `status: "failed"`
- [ ] `PlanResult.approved === false` si cualquier gate required=true falla o es blocked

## AC5: Providers no disponibles manejados correctamente

- [ ] `GentlemanProviderAdapter.checkAvailability()` → `status: "unsupported"` cuando CLI ausente, sin excepción
- [ ] Agente `unavailable` en catálogo → `AgentResolver` intenta siguiente candidato
- [ ] Sin candidatos alternativos → `BLOCKED`, no asignación inválida silenciosa

## AC6: Inmutabilidad de repos externos

- [ ] Ninguna operación escribe en `D:\Adrian\10. IA\ruflo\`
- [ ] Ninguna operación escribe en `vendor/awesome-copilot\`
- [ ] Ninguna operación clona, modifica ni elimina archivos en repos externos
- [ ] Verificable: `git status` en repos externos no muestra cambios tras ejecución

## AC7: Compilación TypeScript limpia

- [ ] `pnpm exec tsc --noEmit` en workspace completo → 0 errores
- [ ] Tipos de `agent.ts`, `results.ts`, `orchestration.ts` importables desde `@gru/shared`
- [ ] No importaciones circulares entre ports

## AC8: No-regresión

- [ ] `pnpm gru status` muestra mismos providers con mismo estado que antes del cambio
- [ ] ECC, Ruflo, AwesomeCopilot existentes no degradan en status
- [ ] DeepAgents mantiene comportamiento `host-managed`/`sdk-managed`

## AC9: SupervisionPolicy auditable

- [ ] `SupervisionPolicy.validate(assignment)` retorna lista vacía para assignment válido
- [ ] Retorna violaciones nombradas (`"noSelfApproval"`, `"requireRufloTester"`, etc.) para assignment inválido
- [ ] Violaciones son strings, no excepciones — caller decide cómo manejar

## Criterio de completitud (Definition of Done)

Todos los criterios AC1–AC9 marcados. `pnpm exec tsc --noEmit` verde. Tests unitarios de V2–V6 pasan. `pnpm gru status` no regresa.
