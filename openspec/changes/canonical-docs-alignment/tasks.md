# Tasks: canonical-docs-alignment

## T0 — Aprobación humana (bloqueante, antes de cualquier escritura)

- [x] Preguntar al usuario: ¿inglés (patrón actual de CLAUDE.md raíz + los 3 archivos de
  gru_orchestrator) o español (patrón actual de AGENTS.md/GEMINI.md raíz) como idioma
  canónico único para los 3 archivos raíz? → validation.md §T0
- [x] Confirmar que se puede sobrescribir AGENTS.md/GEMINI.md (raíz) tras backup →
  validation.md §T0

## T1 — Backup

- [x] Copiar `AGENTS.md` y `GEMINI.md` (raíz, contenido actual pre-cambio) a
  `openspec/changes/canonical-docs-alignment/legacy-backup/` → validation.md §T1

## T2 — Consolidar cambios de los 3 changes dependientes en CLAUDE.md (raíz)

- [x] Confirmar que `l3-spec-doublecheck` (3c/3d), `agent-browser-integration` (mención
  del CLI) y `quality-gate-skills` (trigger six-hats) ya están aplicados en CLAUDE.md
  (raíz) — si no, aplicarlos aquí como parte de este paso → validation.md §T2

## T3 — Sincronizar los 3 archivos raíz

- [x] Copiar `CLAUDE.md` (raíz) → `AGENTS.md` (raíz), byte-idéntico → validation.md §T3
- [x] Copiar `CLAUDE.md` (raíz) → `GEMINI.md` (raíz), byte-idéntico → validation.md §T3

## T4 — Verificación de no-regresión en gru_orchestrator

- [x] Confirmar `gru_orchestrator/CLAUDE.md` = `AGENTS.md` = `GEMINI.md` sigue en exit 0
  (no se tocó por error) → validation.md §T4
