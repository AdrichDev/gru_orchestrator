# Spec: Gru Agentic Provider Orchestration

## S1: Descubrimiento de agentes reales

**Given** Ruflo tiene `D:\Adrian\10. IA\ruflo\.agents\skills\agent-coder\SKILL.md` con frontmatter válido  
**When** `RufloProviderAdapter.getCatalog().listAgents()` es llamado  
**Then** devuelve `AgentDescriptor` con `id: "agent-coder"`, `canWrite: true`, `canReview: false`, `availability: "available"`

**Given** `SKILL.md` tiene frontmatter inválido o ausente  
**When** el catálogo intenta parsear el archivo  
**Then** el agente se marca `availability: "unavailable"` con `reason: "frontmatter inválido"` — no se lanza excepción

**Given** AwesomeCopilot catálogo no existe en `vendor/awesome-copilot/skills`  
**When** `AwesomeCopilotProviderAdapter.checkAvailability()` es llamado  
**Then** devuelve `status: "unavailable"`, hint accionable, sin agentes en catálogo

**Given** AwesomeCopilot catálogo existe  
**When** `getCatalog().findByPhase("apply")` es llamado  
**Then** devuelve solo skills con `supportedPhases` que incluya `"apply"`; no carga body de skills no relevantes

## S2: Resolución de ejecutor/reviewer/tester

**Given** fase `"apply"` con tarea de implementación  
**When** `AgentResolver.resolve(task, "apply")` es llamado  
**Then** `TaskAssignment.executor.canWrite === true`  
**And** `TaskAssignment.reviewer.id !== TaskAssignment.executor.id`  
**And** `TaskAssignment.tester.provider === "ruflo"`

**Given** no hay agente Ruflo disponible como tester  
**When** `AgentResolver.resolve(task, "apply")` es llamado  
**Then** lanza error con código `"CAPABILITY_UNSUPPORTED"` y `recoverable: false`  
**And** `QualityGateResult` para `"test-evidence"` devuelve `status: "blocked"`

**Given** el mismo agente intenta ser executor y reviewer  
**When** `SupervisionPolicy.noSelfApproval` es evaluado  
**Then** `TaskAssignment` es rechazado — se selecciona reviewer diferente o se bloquea

## S3: Ejecución supervisada

**Given** `TaskAssignment` con executor, reviewer y tester válidos  
**When** Gru ejecuta el plan  
**Then** el orden es: executor → reviewer → tester  
**And** reviewer recibe output de executor, no el prompt original  
**And** tester recibe output de executor + resultado de reviewer

**Given** reviewer devuelve `approved: false` con blockers  
**When** Gru consolida resultados  
**Then** `PlanResult.approved === false`  
**And** `PlanResult.blockers` contiene los blockers del reviewer  
**And** no se procede a siguiente tarea del plan

**Given** tester devuelve `passed: false` con regresiones  
**When** Gru evalúa quality gates  
**Then** gate `"code-regression"` devuelve `status: "failed"`  
**And** `PlanResult.approved === false`

## S4: Quality gates

**Given** tarea completada sin evidencia de tests (`TestEvidence` ausente)  
**When** gate `"test-evidence"` es evaluado  
**Then** `status: "blocked"` — no `"passed"` por defecto

**Given** reviewer es del mismo provider que executor  
**When** gate `"review-independence"` es evaluado  
**Then** `status: "failed"` si son el mismo agente, `"passed"` si son distintos del mismo provider pero con ids diferentes

**Given** tarea de `"apply"` sin trazabilidad a artefactos SDD  
**When** gate `"sdd-traceability"` es evaluado  
**Then** `status: "failed"` si no existe `proposal.md` + `spec.md` + `design.md` + `tasks.md`

## S5: Providers no disponibles

**Given** Gentleman CLI (`gentle-ai`) no instalado  
**When** `GentlemanProviderAdapter.checkAvailability()` es llamado  
**Then** `status: "unsupported"`, no `"unavailable"` (CLI nunca existió en este entorno)

**Given** Ruflo CLI disponible pero agente específico tiene `availability: "unavailable"`  
**When** `AgentResolver` intenta asignar ese agente  
**Then** intenta con siguiente agente del catálogo del mismo tipo  
**And** si no hay alternativa → `BLOCKED`, no degradación silenciosa

## S6: No modificación de repos externos

**Given** cualquier operación sobre `vendor/awesome-copilot` o `D:\Adrian\10. IA\ruflo`  
**When** ProviderAdapter ejecuta  
**Then** solo lee `SKILL.md` — nunca escribe, modifica ni clona nada en repos externos  
**And** `sourcePath` es relativo o absoluto pero nunca apunta a rutas fuera del proyecto propio
