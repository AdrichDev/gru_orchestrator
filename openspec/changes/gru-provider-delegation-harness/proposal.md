# Proposal — Gru Provider Delegation Harness

## Problem

`Gru-Orchestrator` ya orquesta providers en dos capas: flujo **simple**
(`GruProvider.run`) y flujo **agentic** (`ProviderAdapter.execute(TaskAssignment)`
con resolver, supervisión y gates). Falta una capa que permita **delegar una
operación concreta a cualquier provider de forma uniforme**, con:

- detección de disponibilidad real,
- declaración y validación de operaciones soportadas,
- estado de ejecución normalizado y honesto,
- referencias portables,
- sin reimplementar el runtime de ningún provider.

Sin esta capa, cada consumidor tendría que conocer el mecanismo nativo de cada
provider (CLI/SDK/catálogo/MCP) y arriesgaría falsos positivos (`exitCode 0`,
workflow registrado, ID externo) interpretados como éxito.

## Solution

Introducir un **tercer contrato, `ProviderDelegate`**, como **fachada** sobre los
contratos existentes — sin renombrarlos ni sustituirlos:

```
ProviderDelegate (detect / getCapabilities / execute)
  ├── SimpleProviderDelegate   → envuelve GruProvider.run
  └── AgenticProviderDelegate  → envuelve ProviderAdapter.execute
```

La fachada **traduce, valida y normaliza**; no duplica la lógica interna del
provider. Un `DelegationProviderRegistry` registra todos los delegates y expone
solo los disponibles (`getAvailable()`), sin fallback silencioso.

## Scope

**Esta fase (Fase 0 + Fase 1):**
- Artefactos OpenSpec (este cambio).
- Port `delegation.ts` (contrato + tipos del SDD).
- Delegates wrappers (9 providers: ruflo, ecc, gentlePi, gentlemanCli,
  deepagents, engram, awesomeCopilot, context7, local).
- Registry de delegación + tabla de capacidades/allowlists.
- Tests de contrato.

**Fuera de alcance (Fase 2+):** CapabilityResolver, DelegationPlanner (DAG),
ContextCollector, provider-invoker, result-collector, DelegationOrchestrator,
CLI multi-provider, Context7 MCP real, Engram real.

## Detected resources (reales)

| Provider | Mecanismo real | Integración |
|----------|----------------|-------------|
| ruflo | `ruflo workflow run` (async, requiere MCP) | READY (submit) |
| ecc | `ecc consult <prompt>` (sync) | READY |
| awesomeCopilot | lectura de catálogo `vendor/awesome-copilot` | READY |
| gentlePi | `pi -p <prompt>` | READY (CLI ausente en este entorno) |
| gentlemanCli | `gentle-ai consult` | READY (CLI ausente) |
| deepagents | SDK `createDeepAgent().invoke()` | READY (sin key/harness) |
| engram | `engram search` | READY (CLI ausente) |
| context7 | — (MCP no implementado) | **PLANNED** |
| local | — (sin runtime) | READY (no operativo) |

## Non-goals

Reimplementar/absorber runtimes de providers · hacer que los providers se llamen
entre sí · convertir cada `SKILL.md` en agente ejecutable · tratar AwesomeCopilot
o Engram como ejecutores genéricos · inventar documentación (Context7) · marcar
`COMPLETED` sin resultado terminal real · fallback silencioso · persistir rutas
absolutas como referencias canónicas.
