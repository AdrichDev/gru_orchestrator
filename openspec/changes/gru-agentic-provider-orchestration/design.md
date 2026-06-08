# Design: Gru Agentic Provider Orchestration

## Arquitectura

```
Gru Core
  │
  ├── ProviderRegistry
  │     ├── GentlemanProviderAdapter   (gentlemanCli)
  │     ├── AwesomeCopilotProviderAdapter (awesomeCopilot)
  │     └── RufloProviderAdapter       (ruflo)
  │
  ├── AgentResolver
  │     ├── busca executor por fase/dominio/canWrite
  │     ├── busca reviewer independiente
  │     └── busca tester Ruflo (obligatorio)
  │
  ├── ExecutionPlan
  │     └── TaskAssignment[]
  │           ├── executor: AgentDescriptor
  │           ├── reviewer: AgentDescriptor (id ≠ executor.id)
  │           ├── tester: AgentDescriptor (provider = ruflo)
  │           └── gates: QualityGate[]
  │
  └── SupervisionPolicy
        ├── noSelfApproval: true
        ├── requireRufloTester: true
        └── blockOnMissingEvidence: true
```

## Contratos de datos

Ver `packages/shared/src/ports/`:
- `agent.ts` — AgentDescriptor, CapabilityDescriptor, AgentCatalog, SddPhase
- `orchestration.ts` — ProviderAdapter, ProviderRegistry, AgentResolver, TaskAssignment, ExecutionPlan, SupervisionPolicy
- `results.ts` — ExecutionResult, ReviewResult, TestEvidence, QualityGateResult

## Parsing de SKILL.md

```
SKILL.md (frontmatter YAML)
  │
  ├── name → AgentDescriptor.name
  ├── type → heurística canWrite/canReview/canTest
  ├── capabilities[] → AgentDescriptor.capabilities
  ├── description → AgentDescriptor.description
  └── (ausente/inválido) → availability: "unavailable"
```

Heurística de roles por `type`:
| type | canWrite | canReview | canTest |
|---|---|---|---|
| developer / coder | true | false | false |
| validator / reviewer | false | true | false |
| tester | false | false | true |
| architect / planner | false | false | false |
| security | false | true | true |

Si `type` no reconocido → conservador: todo `false`, `availability: "available"`.

## Lazy indexing

```
AgentCatalog.listAgents()
  → lee solo nombres de carpetas en .agents/skills/
  → carga SKILL.md solo al acceder a un agente concreto
  → nunca carga todos los bodies en contexto a la vez
```

Límite: máximo 50 agentes indexados por llamada a `findByPhase()` o `findByCapability()`.

## Flujo de resolución

```
AgentResolver.resolve(task, phase)
  1. Buscar executors disponibles para la fase (canWrite=true si phase=apply)
  2. Priorizar: AwesomeCopilot si tiene skill real compatible → Ruflo coder → BLOCKED
  3. Buscar reviewer: Ruflo reviewer ≠ executor.id
  4. Buscar tester: Ruflo tester (obligatorio) → si ausente: BLOCKED
  5. Construir TaskAssignment con gates estándar
```

## Flujo de ejecución

```
ExecutionPlan.run()
  for each TaskAssignment:
    1. executor.run(task) → ExecutionResult
    2. reviewer.review(executionResult) → ReviewResult
       - si reviewer.approved = false → STOP, return blockers
    3. tester.test(executionResult) → TestEvidence
       - si tester.passed = false → gate code-regression = failed
    4. evaluar QualityGates
    5. Gru consolida → PlanResult
```

## Gentleman adapter

Gentleman no es ejecutor de código. Su adapter:
- `checkAvailability()` → prueba `gentle-ai --version`
- `getCatalog()` → catálogo de fases SDD, no de agentes ejecutores
- `execute()` → normaliza una fase SDD: valida artefactos openspec/changes, devuelve status

Gentleman no produce código. Valida que artefactos SDD (proposal/spec/design/tasks) existen antes de avanzar a `apply`.

## AwesomeCopilot adapter

Extiende el provider actual. Además de `checkAvailability()` existente:
- Parsea `SKILL.md` bajo `vendor/awesome-copilot/skills/` a `AgentDescriptor`.
- `sourceRef` usa ruta relativa al catálogo.
- Solo participa como executor si `skill.supportedPhases` incluye la fase pedida.

## Ruflo adapter

- Indexa lazy `D:\Adrian\10. IA\ruflo\.agents\skills\*\SKILL.md`.
- Normaliza `agent-coder`, `agent-reviewer`, `agent-tester`, etc. a `AgentDescriptor`.
- Marca `canWrite/canReview/canTest` por heurística conservadora de `type`.
- Provee supervisor/reviewer/tester independiente.
- Ruta a `SKILL.md` almacenada como `sourcePath`, no copiada.

## Nuevos archivos

| Archivo | Acción |
|---|---|
| `packages/shared/src/ports/agent.ts` | NUEVO — contratos AgentDescriptor, SddPhase, AgentCatalog |
| `packages/shared/src/ports/orchestration.ts` | NUEVO — ProviderAdapter, ProviderRegistry, AgentResolver, TaskAssignment, ExecutionPlan, SupervisionPolicy |
| `packages/shared/src/ports/results.ts` | NUEVO — ExecutionResult, ReviewResult, TestEvidence, QualityGateResult |
| `packages/kernel/src/adapters/gentleman.ts` | NUEVO — GentlemanProviderAdapter |
| `packages/kernel/src/adapters/awesome-copilot.ts` | NUEVO — AwesomeCopilotProviderAdapter |
| `packages/kernel/src/adapters/ruflo.ts` | NUEVO — RufloProviderAdapter |
| `packages/kernel/src/adapters/resolver.ts` | NUEVO — DefaultAgentResolver |
| `packages/kernel/src/adapters/supervision.ts` | NUEVO — SupervisionPolicy default |
| `packages/providers/ruflo/src/index.ts` | MODIFICAR — añadir `kind: "cli"`, `status` a availability |
| `packages/providers/gentleman-cli/src/index.ts` | MODIFICAR — añadir `kind: "cli"`, normalización SDD |

## Archivos que NO se tocan

- `D:\Adrian\10. IA\ruflo\` — solo lectura
- `D:\Adrian\10. IA\Gentleman\` — solo lectura
- `vendor/awesome-copilot\` — solo lectura
