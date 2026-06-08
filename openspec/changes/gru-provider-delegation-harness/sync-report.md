# Sync Report — Gru Provider Delegation Harness

## Estado del cambio
- Fase 0 (artefactos) + Fase 1 (contratos/wrappers/registry/tests): **completadas y verificadas**.
- Fase 2+ (resolver/planner/orchestrator/CLI/Context7-MCP/Engram real): **pendiente, fuera de alcance**.

## Superficie añadida (no rompe nada existente)
- Nuevo port: `packages/shared/src/ports/delegation.ts` (+ export en `index.ts`).
- Nuevo módulo: `packages/kernel/src/delegates/*` (base, capabilities, registry,
  awesome-copilot, context7, index) + tests.
- Contratos existentes (`GruProvider`, `ProviderAdapter`), `task-router` y
  `orchestrator` **sin modificar**.

## Pendiente de integración (Fase 2)
La capa de delegación está disponible vía `createDelegationRegistry()` pero **aún
no está cableada al CLI ni al orchestrator**. No hay flag `--delegate` todavía.
El consumo real (planner/orchestrator) es la siguiente fase.

## Riesgos / deudas conocidas
- Ruflo solo alcanza estados terminales reales con MCP + Claude Code activos;
  documentado como SUBMITTED/UNSUPPORTED honesto.
- Context7 PLANNED: requiere adapter MCP real antes de habilitar.
- Engram/gentlePi/gentlemanCli/deepagents: UNAVAILABLE hasta instalar su runtime.

## Próximos pasos sugeridos
1. CapabilityResolver + DelegationPlanner (DAG `dependsOn`).
2. ContextCollector + DelegationOrchestrator con supervisión/gates/trazabilidad.
3. CLI `--delegate`.
4. Adapters reales: Context7 MCP, Engram store/retrieve.
