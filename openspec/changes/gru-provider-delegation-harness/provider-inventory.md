# Provider Inventory — capacidades y operaciones REALES

Derivado del código real de cada provider (`packages/providers/*/src/index.ts`).
No se declaran capacidades falsas. Operaciones de Context7 = **previstas**, no reales.

## Capacidades por provider

| Provider | Mecanismo real | Capacidades (flags) | Operaciones reales | Sync | Estado sin setup |
|----------|----------------|---------------------|--------------------|------|------------------|
| ruflo | `ruflo workflow run -t <tpl> --task` (async; requiere MCP) | planning, implementation, review, testing, security, multiAgent | `plan`, `implement`, `review`, `test`, `security`, `swarm` | no | SUBMITTED→UNSUPPORTED |
| ecc | `ecc consult <prompt>` (sync) | review, security | `consult`, `review`, `security` | sí | COMPLETED (READY) |
| gentlePi | `pi -p <prompt>` | sdd, planning, review, testing | `sdd`, `plan`, `review`, `test` | sí | UNAVAILABLE (CLI ausente) |
| gentlemanCli | `gentle-ai consult <prompt>` | sdd, planning | `sdd`, `plan` | sí | UNAVAILABLE (CLI ausente) |
| deepagents | SDK `createDeepAgent().invoke()` | planning, implementation, multiAgent | `plan`, `implement`, `subagents` | sí | UNAVAILABLE (sin key/harness) |
| awesomeCopilot | lectura de catálogo (`vendor/awesome-copilot/skills`) | skillDiscovery | `skill.discover`, `skill.search`, `skill.read`, `catalog.search` | sí | COMPLETED (lectura real) |
| engram | `engram search <prompt>` | memory | `memory.search`, `memory.retrieve`, `memory.store` | sí | UNAVAILABLE (CLI ausente) |
| context7 | — (MCP no implementado) | documentation | *(previstas)* `documentation.search`, `documentation.resolve`, `documentation.fetch` | sí | **UNAVAILABLE (PLANNED)** |
| local | — (sin runtime) | — | ∅ (ninguna registrada) | — | UNAVAILABLE |

## Notas

- **ruflo**: el `workflow run` solo registra el workflow; sin MCP + Claude Code
  consumiendo los `type:task` steps, nunca alcanza `completed` → mapea a
  SUBMITTED/RUNNING/UNSUPPORTED. Jamás COMPLETED por aceptación.
- **ecc / awesomeCopilot**: únicos READY-operativos en este entorno.
- **awesomeCopilot**: una `SKILL.md` es un recurso, no un agente ejecutable; solo
  operaciones de descubrimiento. Refs emitidas como `awesome-copilot:<rel-path>`.
- **context7**: integración PLANNED. Las operaciones listadas son **previstas**
  (no reales) hasta implementar el adapter MCP.
- **engram**: registrado, pero al estar la CLI ausente queda fuera de `getAvailable()`.
- **local**: sin operaciones deterministas registradas; no actúa como fallback.

## Referencias lógicas (portables)
`awesome-copilot:skill:<id>` · `ruflo:workflow:<id>` · `engram:memory:<id>` ·
rutas relativas `vendor/awesome-copilot/skills/<x>/SKILL.md`.
