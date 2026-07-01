# Tasks: canonical-docs-critical-audit

## T1 — Crear docs/harness-reference.md (raíz)

- [x] Crear `docs/harness-reference.md` a nivel raíz (carpeta nueva `docs/` si no existe)
  → validation.md §T1
- [x] Mover las 5 secuencias completas (`Level 0` a `Level 4`) de `CLAUDE.md` (raíz) a este
  archivo, sección `## Workflows by Level — Full Sequences` → validation.md §T1
- [x] Mover el detalle de `Project Intake` (New/Existing Project, Context Confidence Level)
  de `CLAUDE.md` (raíz) al mismo archivo → validation.md §T1

## T2 — Compactar CLAUDE.md (raíz)

- [x] Sustituir las 5 secuencias inline por la tabla compacta de 5 filas + pointer (ver
  design.md) → validation.md §T2
- [x] Sustituir el detalle de Project Intake por un pointer equivalente →
  validation.md §T2
- [x] Confirmar que `CLAUDE.md` (raíz) queda por debajo de 460 líneas (referencia:
  `gru_orchestrator/CLAUDE.md` tiene 464 con MÁS secciones propias — root debería quedar
  más corto al no tener Terminology/Delegation Rules/Strict Provider Runtime) →
  validation.md §T2

## T3 — Reapuntar changes hermanos (secuencia)

- [x] Editar `tasks.md` de `l3-spec-doublecheck`: cambiar destino "CLAUDE.md (raíz)" por
  "docs/harness-reference.md (raíz), sección Level 3 — Large" → validation.md §T3
- [x] Editar `tasks.md` de `quality-gate-skills`: mismo ajuste para el trigger de
  six-hats-review → validation.md §T3

## T4 — Detección de citantes rotos

- [x] `grep -rln "CLAUDE.md#" .` (referencias por ancla a secciones movidas) fuera de
  `node_modules`/`vendor` → si hay resultados, actualizar cada uno → validation.md §T4

## T5 — Proponer (no aplicar) check de drift CI

- [x] Documentar en `docs/harness-reference.md` (raíz) la recomendación de un script
  `diff CLAUDE.md AGENTS.md && diff CLAUDE.md GEMINI.md` como gate futuro — como nota,
  sin implementarlo en este change (fuera de scope, es tooling nuevo) →
  validation.md §T5
