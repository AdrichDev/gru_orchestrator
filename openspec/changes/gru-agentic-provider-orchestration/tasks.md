# Tasks: Gru Agentic Provider Orchestration

## T0: Contratos TypeScript (COMPLETADO)

- [x] `packages/shared/src/ports/agent.ts` — AgentDescriptor, SddPhase, AgentCatalog
- [x] `packages/shared/src/ports/results.ts` — ExecutionResult, ReviewResult, TestEvidence, QualityGateResult
- [x] `packages/shared/src/ports/orchestration.ts` — ProviderAdapter, ProviderRegistry, AgentResolver, TaskAssignment, ExecutionPlan, SupervisionPolicy

**Gate:** `pnpm exec tsc --noEmit` pasa sin errores.

---

## T1: RufloProviderAdapter

**Archivo:** `packages/kernel/src/adapters/ruflo.ts`

- [ ] Scan lazy de `D:\Adrian\10. IA\ruflo\.agents\skills\*\SKILL.md`
- [ ] Parser de frontmatter YAML → `AgentDescriptor`
- [ ] Heurística `canWrite/canReview/canTest` por campo `type`
- [ ] Agente con frontmatter inválido → `availability: "unavailable"`, no throw
- [ ] `findByPhase(phase)` → filtra por `supportedPhases`
- [ ] `findByMode(mode)` → filtra por `executionMode`
- [ ] `checkAvailability()` → verifica que ruta Ruflo existe

**Gate:** test unitario con SKILL.md de fixture cubre happy path + frontmatter inválido.

---

## T2: AwesomeCopilotProviderAdapter

**Archivo:** `packages/kernel/src/adapters/awesome-copilot.ts`

- [ ] Extiende provider existente `packages/providers/awesome-copilot/src/index.ts`
- [ ] Scan lazy de `vendor/awesome-copilot/skills/*/SKILL.md`
- [ ] Parser de frontmatter → `AgentDescriptor`
- [ ] `supportedPhases` desde frontmatter; si ausente → vacío, no inferir
- [ ] Límite: máximo 50 skills por consulta
- [ ] Solo lectura — nunca modifica `vendor/`

**Gate:** `checkAvailability()` pasa + catálogo devuelve >0 agentes si vendor/ existe.

---

## T3: GentlemanProviderAdapter

**Archivo:** `packages/kernel/src/adapters/gentleman.ts`

- [ ] `checkAvailability()` → prueba `gentle-ai --version`
- [ ] Si CLI ausente → `status: "unsupported"` (no `"unavailable"`)
- [ ] `getCatalog()` → catálogo de fases SDD, no ejecutores de código
- [ ] `execute(assignment)` → valida artefactos openspec/changes/`<sdd-id>/` para la fase
- [ ] Gentleman no escribe código — solo valida/avanza workflow

**Gate:** disponibilidad returna `unsupported` en entorno sin `gentle-ai` sin lanzar excepción.

---

## T4: DefaultAgentResolver

**Archivo:** `packages/kernel/src/adapters/resolver.ts`

- [ ] `resolve(task, phase)`:
  1. Busca executor (canWrite=true si phase=apply, etc.)
  2. Prioriza AwesomeCopilot si skill compatible; fallback Ruflo coder
  3. Busca reviewer independiente (id ≠ executor.id)
  4. Busca tester Ruflo — si ausente: throw `CAPABILITY_UNSUPPORTED` recoverable=false
- [ ] Construye `TaskAssignment` con gates estándar del contexto
- [ ] No degrada silencioso — bloquea antes de retornar asignación inválida

**Gate:** test prueba que executor ≠ reviewer en todos los caminos; Ruflo ausente → throw.

---

## T5: SupervisionPolicy default

**Archivo:** `packages/kernel/src/adapters/supervision.ts`

- [ ] Implementa `SupervisionPolicy` con valores por defecto:
  - `noSelfApproval: true`
  - `requireRufloTester: true`
  - `requireRufloReviewer: true`
  - `requireIndependentReview: true`
  - `requireFreshContext: false` (harness-dependent)
  - `blockOnMissingEvidence: true`
- [ ] Función `validate(assignment: TaskAssignment): string[]` → devuelve lista de violaciones

**Gate:** test cubre autoaprobación intentada → violación reportada.

---

## T6: Quality gates

**Archivo:** `packages/kernel/src/gates/`

- [ ] `spec-compliance.ts` — verifica output contra spec.md (heurística simple: busca keywords de criterios)
- [ ] `code-regression.ts` — evalúa `TestEvidence.regressions.length === 0`
- [ ] `security.ts` — evalúa findings severity=blocker de ReviewResult sin fix
- [ ] `test-evidence.ts` — falla si `TestEvidence` ausente; `blocked` si Ruflo no disponible
- [ ] `review-independence.ts` — falla si `executor.id === reviewer.id`
- [ ] `sdd-traceability.ts` — verifica existencia de proposal.md + spec.md + design.md + tasks.md

**Gate:** cada gate tiene test unitario con caso passed y caso failed.

---

## T7: ProviderRegistry

**Archivo:** `packages/kernel/src/adapters/registry-agentic.ts`

- [ ] Implementa `ProviderRegistry`
- [ ] `register(adapter)`, `get(id)`, `list()`, `getAvailable()` (filtra por checkAvailability)
- [ ] Integra RufloAdapter, AwesomeCopilotAdapter, GentlemanAdapter

**Gate:** `getAvailable()` solo incluye adapters con status `"available"`.

---

## T8: TSC + tests de integración

- [ ] `pnpm exec tsc --noEmit` — 0 errores en workspace completo
- [ ] Test de integración: `AgentResolver` con Ruflo real (si path existe)
- [ ] Test de integración: `ProviderRegistry.getAvailable()` en entorno real

**Gate:** CI verde (si existe) o `pnpm test` pasa localmente.

---

## T9: Actualizar exports shared

**Archivo:** `packages/shared/src/index.ts` (o barrel equivalente)

- [ ] Re-exportar tipos de `agent.ts`, `results.ts`, `orchestration.ts`
- [ ] Verificar imports circulares

**Gate:** consumer puede importar `AgentDescriptor` desde `@gru/shared` sin path interno.

---

## Orden de ejecución

T0 → T1 → T2 → T3 → T4 → T5 → T6 → T7 → T9 → T8

T1/T2/T3 pueden ejecutarse en paralelo. T4 depende de T1+T2+T3. T6 depende de T5.
