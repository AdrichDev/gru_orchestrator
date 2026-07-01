# Tasks: quality-gate-skills

## T1 — Skill nueva six-hats-review

- [x] Crear `.claude/skills/six-hats-review/SKILL.md` (raíz) con frontmatter + guion de
  6 pasadas (ver design.md) → validation.md §T1
- [x] Insertar trigger de six-hats-review en workflow L3/L4 (`architect` step) en
  `docs/harness-reference.md` (raíz, sección `#workflow-sequences` — reapuntado tras
  `canonical-docs-critical-audit`, ya aplicado) y en `gru_orchestrator/docs/harness-reference.md`
  → validation.md §T1

## T2 — Referencias a quality-playbook y ADR (sin copiar catálogo)

- [x] Añadir en `gru_orchestrator/docs/harness-reference.md` (o `minion-catalog`) la
  referencia de invocación condicional a `quality-playbook` en `reviewer` para 4+ archivos
  → validation.md §T2
- [x] Añadir referencia de `create-architectural-decision-record` en el paso `architect`
  + convención `docs/adr/` (confirmar ubicación con usuario antes de crear la carpeta)
  → validation.md §T2

## T3 — Verificación de no-duplicación

- [x] Confirmar que `six-hats-review` no repite el contenido de `devil` (Black Hat es
  insumo, no auditoría final) → validation.md §T3
- [x] Confirmar que ninguna skill de la lista "NO adoptar" (doublecheck, eyeball,
  review-and-refactor, structured-autonomy-*) se copió al catálogo local → validation.md §T3
