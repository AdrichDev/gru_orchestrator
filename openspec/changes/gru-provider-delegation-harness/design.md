# Design — Gru Provider Delegation Harness

## Architecture

```
        ProviderDelegate  (fachada de delegación)
              │ detect() / getCapabilities() / execute(req)
   ┌──────────┴───────────┐
   │                      │
SimpleProviderDelegate   AgenticProviderDelegate
   │ wrap                 │ wrap
   ▼                      ▼
GruProvider.run()       ProviderAdapter.execute(TaskAssignment)
(ecc, gentlePi,         (ruflo: ciclo de vida workflow)
 gentlemanCli, engram,
 deepagents, local,
 awesomeCopilot*)

Context7Delegate  → integración PLANNED, siempre UNAVAILABLE
DefaultDelegationRegistry → register/get/list/getAvailable
```

`*` AwesomeCopilot extiende `SimpleProviderDelegate` para emitir refs portables.

## Naming decision

El SDD nombra el contrato `GruProvider`, pero ese nombre ya lo usa el flujo
simple (`canHandle/checkAvailability/run`). Para **no romper** los flujos
existentes, el contrato de delegación se llama **`ProviderDelegate`**. `GruProvider`
y `ProviderAdapter` quedan intactos. `ProviderDelegate` es estrictamente una
fachada (traduce/valida/normaliza), no un runtime nuevo.

## Data contracts (`packages/shared/src/ports/delegation.ts`)

- `DelegationProviderId = ProviderId | "context7"` — Context7 vive solo en la
  capa de delegación; **no** se muta `ProviderId` central (rompería los
  `Record<Exclude<ProviderId,"local">>` exhaustivos de `task-router`/`orchestrator`).
- `ProviderExecutionStatus = COMPLETED | SUBMITTED | RUNNING | FAILED | BLOCKED | TIMEOUT | UNAVAILABLE | UNSUPPORTED`.
- `ProviderDetection { status: AVAILABLE|UNAVAILABLE|UNSUPPORTED, integration: READY|PLANNED|DISABLED, ... }`.
- `ProviderCapability { name, operations[], synchronous }` + `ProviderCapabilityFlags`.
- `ProviderExecutionRequest` / `ProviderExecutionResult` (incluye `externalExecutionId`, `evidenceRefs`).
- `ProviderDelegate`, `DelegationRegistration`, `DelegationProviderRegistry`.

## Rule A — Honest status

`COMPLETED` exige un resultado terminal real y recuperable. **Nunca** se infiere de:
package importado · CLI detectada · `exitCode: 0` · ID externo recibido · workflow
registrado · tarea aceptada · estado `pending`/`running`.

- `SUBMITTED`/`RUNNING` **no** se transforman en `COMPLETED`.
- `TIMEOUT` **no** degrada a `FAILED` genérico.
- Se preservan `externalExecutionId`/`workflowId`/`evidenceRefs` cuando existen.

Mapeo Ruflo (en `normalizeExecutionResult`, leyendo el artifact `ruflo:workflow:<id>:<state>`):

| Workflow state | ProviderExecutionStatus |
|----------------|-------------------------|
| completed | COMPLETED |
| running | RUNNING |
| submitted / queued | SUBMITTED |
| failed | FAILED |
| timeout | TIMEOUT |
| unknown (sin progreso) | UNSUPPORTED |

## Rule B — Operation validation

Cada delegate declara su allowlist (`capabilities.ts`). `assertOperation()` se
ejecuta **antes** de tocar el runtime; operación no soportada →
`{ status: "UNSUPPORTED", error: "Operation not supported by provider" }` **sin**
llamar a `run()`/`execute()`.

Allowlists reales:
- awesomeCopilot: `skill.discover`, `skill.search`, `skill.read`, `catalog.search`.
- engram: `memory.search`, `memory.retrieve`, `memory.store`.
- context7 (PLANNED): `documentation.search`, `documentation.resolve`, `documentation.fetch`.
- ecc: `consult`, `review`, `security`.
- ruflo: `plan`, `implement`, `review`, `test`, `security`, `swarm` (async).
- gentlePi: `sdd`, `plan`, `review`, `test`. gentlemanCli: `sdd`, `plan`.
- deepagents: `plan`, `implement`, `subagents`. local: ∅.

Un `SKILL.md` es un recurso, no un agente ejecutable; AwesomeCopilot solo expone
operaciones de descubrimiento.

## Rule C — Portable refs

`artifacts`/`evidenceRefs`/`sourceRef` persistidos usan refs relativas
(`vendor/awesome-copilot/skills/<x>/SKILL.md`) o lógicas
(`awesome-copilot:skill:<id>`, `ruflo:workflow:<id>`, `engram:memory:<id>`).
`stripAbsolute()` y el filtro `ABSOLUTE_PATH` eliminan rutas absolutas de detección
y de los artifacts normalizados. Las rutas absolutas solo se usan transitorias en
ejecución, nunca como referencia canónica persistida.

## Rule D — No silent fallback

`getAvailable()` devuelve solo delegates `AVAILABLE`. Si ninguno sirve, el caller
(Fase 2) bloquea; el registry nunca sustituye en silencio. `register()` rechaza
duplicados.

## Context7 (PLANNED)

Adapter MCP real fuera de alcance. `detect()` devuelve `UNAVAILABLE`+`PLANNED`
**incluso si `GRU_CONTEXT7_MCP` está configurado** (se detecta como "config
presente" pero no habilita). `execute()` de una operación prevista devuelve
`UNAVAILABLE` — nunca documentación inventada.
