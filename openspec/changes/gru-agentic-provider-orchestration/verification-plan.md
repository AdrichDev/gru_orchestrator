# Verification Plan: Gru Agentic Provider Orchestration

## Niveles de verificación

### V1: Contratos TypeScript

**Qué:** Los 3 archivos de ports compilan sin errores.

**Cómo:**
```bash
pnpm exec tsc --noEmit
```

**Criterio pass:** 0 errores, 0 warnings TS.

**Cuando:** después de T0, antes de cualquier implementación.

---

### V2: Tests unitarios — ProviderAdapters

**Qué:** Cada adapter maneja paths feliz y errores sin lanzar excepciones inesperadas.

#### V2.1: RufloProviderAdapter

| Caso | Input | Expected |
|---|---|---|
| SKILL.md válido | `agent-coder/SKILL.md` con frontmatter correcto | `AgentDescriptor` con `canWrite: true` |
| SKILL.md inválido | Frontmatter malformado o ausente | `availability: "unavailable"`, no throw |
| Path Ruflo ausente | Directorio inexistente | `checkAvailability()` → `status: "unavailable"` |
| findByPhase("apply") | Mix de agents con/sin "apply" en supportedPhases | Solo agents que declaran "apply" |

#### V2.2: AwesomeCopilotProviderAdapter

| Caso | Input | Expected |
|---|---|---|
| Vendor no existe | `vendor/awesome-copilot` ausente | `checkAvailability()` → `status: "unavailable"` |
| Vendor existe | `vendor/awesome-copilot/skills/*/SKILL.md` | Catálogo con >0 AgentDescriptor |
| Límite catálogo | >50 skills | Máximo 50 retornados |
| Skill sin supportedPhases | SKILL.md sin campo phases | `supportedPhases: []`, no inferir |

#### V2.3: GentlemanProviderAdapter

| Caso | Input | Expected |
|---|---|---|
| CLI ausente | `gentle-ai` no en PATH | `status: "unsupported"`, no throw |
| CLI presente | `gentle-ai --version` ok | `status: "available"` |
| Artefactos SDD ausentes | Phase "apply" sin proposal.md | `execute()` devuelve error descriptivo |

---

### V3: Tests unitarios — AgentResolver + SupervisionPolicy

#### V3.1: AgentResolver

| Caso | Expected |
|---|---|
| fase "apply", Ruflo disponible | executor.canWrite=true, reviewer.id≠executor.id, tester.provider="ruflo" |
| fase "apply", mismo agente para executor+reviewer | segundo intento con agente diferente o BLOCKED |
| Ruflo no disponible | throw `CAPABILITY_UNSUPPORTED`, recoverable=false |
| AwesomeCopilot skill compatible | AwesomeCopilot como executor, no Ruflo coder |

#### V3.2: SupervisionPolicy.validate()

| Caso | Expected |
|---|---|
| executor.id === reviewer.id | Violación `"noSelfApproval"` |
| tester.provider ≠ "ruflo" y requireRufloTester=true | Violación `"requireRufloTester"` |
| TestEvidence ausente + blockOnMissingEvidence=true | Violación `"blockOnMissingEvidence"` |

---

### V4: Tests unitarios — Quality gates

Cada gate tiene fixture de input válido (pass) y fixture de input inválido (fail/blocked).

| Gate | Pass input | Fail input |
|---|---|---|
| spec-compliance | Output con keywords del spec | Output vacío |
| code-regression | `regressions: []` | `regressions: ["AuthTest failed"]` |
| security | findings sin severity=blocker | Finding severity=blocker, fixRequired=true |
| test-evidence | TestEvidence presente, passed=true | TestEvidence ausente |
| review-independence | executor.id ≠ reviewer.id | executor.id === reviewer.id |
| sdd-traceability | 4 artefactos existen en fs | proposal.md ausente |

---

### V5: Test de integración — Ruflo real

**Precondición:** `D:\Adrian\10. IA\ruflo\.agents\skills\` existe con ≥1 SKILL.md.

**Qué:**
```typescript
const adapter = new RufloProviderAdapter({ basePath: "D:\\Adrian\\10. IA\\ruflo" });
const status = await adapter.checkAvailability();
const catalog = adapter.getCatalog();
const agents = await catalog.listAgents();
```

**Criterio pass:** `status.status === "available"`, `agents.length >= 1`, ningún agent tiene `availability: "available"` con `canWrite/canReview/canTest` todos false cuando `type` reconocible.

---

### V6: Test de integración — AwesomeCopilot real

**Precondición:** `vendor/awesome-copilot/skills/` existe.

**Qué:** `listAgents()` retorna >0, ningún agent lanza excepción al parsear.

---

### V7: Test de integración — plan completo simulado

**Qué:** Simular ciclo completo con mocks de executor/reviewer/tester.

**Flujo:**
1. `AgentResolver.resolve(task, "apply")` → `TaskAssignment` válido
2. Simular `executor.run()` → `ExecutionResult` con output
3. Simular `reviewer.review()` → `ReviewResult` approved=true
4. Simular `tester.test()` → `TestEvidence` passed=true
5. Evaluar todos los gates
6. `PlanResult.approved === true`

**Camino alternativo:** reviewer.approved=false → `PlanResult.approved === false`, blockers propagados.

---

### V8: No-regresión providers existentes

Verificar que providers anteriores (ECC, Ruflo existente, AwesomeCopilot existente) siguen funcionando:

```bash
pnpm gru status
```

Criterio: mismo output que antes del cambio. Ningún provider pasa de READY a MISSING por refactor.

---

## Herramientas

- TypeScript compiler: `pnpm exec tsc --noEmit`
- Test runner: según configuración del workspace (vitest / jest)
- Manual: `pnpm gru status` para smoke test visual
