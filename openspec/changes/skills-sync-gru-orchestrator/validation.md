# Validation: skills-sync-gru-orchestrator

## §T1 — Sync mecánico

**Historia**: Como sub-agente lanzado desde `gru_orchestrator`, quiero encontrar la misma
skill que existe en la raíz del proyecto, sin importar desde qué carpeta me invocaron.

**Criterios de aceptación**: las 16 skills listadas (+ `six-hats-review`, creada en el
change `quality-gate-skills` tras redactar esta spec) existen en
`gru_orchestrator/.claude/skills/` con el mismo `SKILL.md` que en `.claude/skills/` (raíz).

**Test que valida**: `diff <(ls .claude/skills) <(ls gru_orchestrator/.claude/skills)` →
**salida vacía** (confirmado tras el sync + copia adicional de `six-hats-review`). Estado: 🟢.

**OK**: [x]

## §T2 — Refrescar registro

**Criterios de aceptación**: el índice de skills (`.atl/skill-registry.md`) incluye las
skills nuevas.

**Test que valida**: `.atl/skill-registry.md` regenerado con **63 skills** indexadas
(escaneo de `.claude/skills/`, excluidos sdd-*/‗shared/skill-registry). Incluye
`webapp-testing`, `docx`, `pdf`, `pptx`, `xlsx`, `mcp-builder`, `six-hats-review`, etc.
Persistido en Engram (`topic_key: skill-registry`, proyecto `creador_crm` — único proyecto
Engram disponible en esta máquina, `gru_orchestrator` aún no registrado como proyecto
propio). Estado: 🟢.

**OK**: [x]

## §T3 — Candidatos descartados documentados

**Criterios de aceptación**: existe una entrada en Engram con los 4 candidatos evaluados
de awesome-copilot (sandbox-npm-install + 3 playwright-*) y la razón de descarte.

**Test que valida**: `mem_save(title: "skills-evaluados-2026-07-01", type: decision)` →
guardado correctamente (id 525), sin conflictos de judgment. Estado: 🟢.

**OK**: [x]

## Checklist final

- [x] T1 OK
- [x] T2 OK
- [x] T3 OK

Change aplicado completo. Nota: `gru_orchestrator` no está registrado como proyecto propio
en Engram (solo `agents-agency`/`creador_crm` existen) — los guardados de esta sesión usan
`project: creador_crm` con override explícito. Considerar registrar `gru_orchestrator` como
proyecto Engram propio en una sesión futura si el volumen de decisiones lo justifica.
