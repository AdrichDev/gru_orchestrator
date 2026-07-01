# Tasks: skills-sync-gru-orchestrator

## T1 — Sync mecánico

- [x] Copiar las 16 carpetas faltantes de `.claude/skills/` a
  `gru_orchestrator/.claude/skills/` (ver comando en design.md) → validation.md §T1
- [x] Confirmar que `gru_orchestrator/.claude/skills/` y `.claude/skills/` (raíz) quedan
  con el mismo listado (salvo `_shared` que ya coincide) → validation.md §T1

## T2 — Refrescar registro

- [x] Ejecutar skill `skill-registry` para regenerar índice tras el sync →
  validation.md §T2

## T3 — Documentar candidatos evaluados (sin copiar)

- [x] Dejar constancia en Engram (`workflows:skills-evaluados-[fecha]`) de los 4 candidatos
  de awesome-copilot descartados y por qué, para no re-evaluarlos en cada sesión futura
  → validation.md §T3
