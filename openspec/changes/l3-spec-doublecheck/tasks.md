# Tasks: Doble validación de spec en L3

## T1 — Documentos raíz

> Reapuntado tras `canonical-docs-critical-audit` (ya aplicado): el detalle de las
> secuencias por nivel vive ahora en `docs/harness-reference.md` (raíz), no en
> `CLAUDE.md`. `CLAUDE.md` solo tiene la tabla compacta de 5 filas.

- [x] `docs/harness-reference.md` (raíz), sección `### Level 3 — Large` (bajo
  `## Workflows by Level — Full Sequences {#workflow-sequences}`): insertar 3c/3d →
  validation.md §T1
- [x] Confirmar que `### Level 4 — Critical` en el mismo archivo también hereda 3c/3d
  (ya incluye "full spec" + "human approval"; 3c/3d va antes de "human approval", no lo
  sustituye) → validation.md §T1
- [x] `CLAUDE.md` (raíz) tabla compacta `WORKFLOWS BY LEVEL`: solo actualizar la celda
  de la fila `3 | Large` para que mencione "→ 3c → 3d →" en el resumen de key steps, sin
  inlinear el detalle completo → validation.md §T1

## T2 — gru_orchestrator (referencia detallada)

- [x] `gru_orchestrator/docs/harness-reference.md` sección `### Level 3 — Large`: insertar
  3c/3d con redacción en inglés (ver design.md) → validation.md §T2
- [x] `gru_orchestrator/docs/harness-reference.md` sección `### Level 4 — Critical`: mismo
  ajuste → validation.md §T2
- [x] `gru_orchestrator/CLAUDE.md` tabla compacta `WORKFLOWS BY LEVEL — COMPACT SUMMARY`:
  NO tocar (sigue apuntando a harness-reference.md, evita duplicar el detalle) →
  validation.md §T2

## T3 — Verificación cruzada

- [x] `grep -rn "3c" CLAUDE.md gru_orchestrator/docs/harness-reference.md` devuelve match en
  ambos archivos → validation.md §T3
- [x] No se rompe la tabla de niveles 0-4 (sigue siendo 5 filas, sin renumerar L0/L1/L2/L4)
  → validation.md §T3

## Nota de secuencia

Este change NO toca `AGENTS.md` / `GEMINI.md` (raíz ni gru_orchestrator) — eso lo hace
`canonical-docs-alignment` después, para no pisarse. Aplicar este change primero.
