# Validation: canonical-docs-critical-audit

## §T1 — Crear referencia raíz

**Historia**: Como mantenedor quiero que el detalle de workflows por nivel viva en un
archivo de referencia raíz, igual que ya vive en `gru_orchestrator/docs/`, para no
inflar el kernel que se carga cada sesión.

**Criterios de aceptación**: `docs/harness-reference.md` (raíz) existe y contiene las
5 secuencias completas (Level 0-4) con el mismo contenido semántico que tenía
`CLAUDE.md` (raíz) antes del cambio — ninguna regla se pierde, solo cambia de archivo.

**Test que valida**: `docs/harness-reference.md` creado con secciones
`## Workflows by Level — Full Sequences {#workflow-sequences}` (5 niveles, texto idéntico
al `CLAUDE.md` original) y `## Project Intake {#project-intake}` (New/Existing/Context
Confidence, texto idéntico al original). Estado: 🟢 — verificado por lectura directa del
archivo creado.

**OK**: [x]

## §T2 — Compactar kernel

**Criterios de aceptación**: `CLAUDE.md` (raíz) tiene la tabla compacta de 5 filas +
pointer a `docs/harness-reference.md#workflow-sequences`, y su longitud total baja
respecto al original (500 líneas).

**Test que valida**: `wc -l CLAUDE.md` → **424** (< 460). Estado: 🟢.

**OK**: [x]

## §T3 — Reapuntar changes hermanos

**Criterios de aceptación**: `l3-spec-doublecheck/tasks.md` y `quality-gate-skills/tasks.md`
referencian `docs/harness-reference.md (raíz)` en vez de `CLAUDE.md (raíz)` como destino
del detalle de 3c/3d y del trigger six-hats.

**Test que valida**: `grep -n "docs/harness-reference.md" l3-spec-doublecheck/tasks.md
quality-gate-skills/tasks.md` → match en ambos archivos (múltiples líneas). Estado: 🟢.

**OK**: [x]

## §T4 — Citantes rotos

**Criterios de aceptación**: cero referencias colgantes a anclas de `CLAUDE.md` (raíz)
que ya no existen tras la extracción.

**Test que valida**: `grep -rn "CLAUDE.md#Level"` (todo el repo) → **sin resultados**.
Estado: 🟢.

**OK**: [x]

## §T5 — Nota de CI (documentación, no implementación)

**Criterios de aceptación**: `docs/harness-reference.md` (raíz) menciona la recomendación
de un check de drift entre CLAUDE.md/AGENTS.md/GEMINI.md, como nota — no hay script nuevo
en el repo.

**Test que valida**: `grep -n "diff CLAUDE.md AGENTS.md" docs/harness-reference.md` →
match en línea 127 (sección `## Recommended future gate...`). Ningún script nuevo creado
en el repo (verificado: solo se creó `docs/harness-reference.md`, ningún `.sh`/`.js` de CI).
Estado: 🟢.

**OK**: [x]

## Checklist final

- [x] T1 OK
- [x] T2 OK
- [x] T3 OK
- [x] T4 OK
- [x] T5 OK

Change aplicado completo. Cambio de estructura documental, sin riesgo de seguridad/
producción — no requería OK humano adicional más allá de la aprobación de aplicar el
change (ya dada por el usuario: "Aprueba el 6, ejecútalo primero").

Efecto en el orden de los otros changes de esta sesión: `l3-spec-doublecheck` y
`quality-gate-skills` ya quedan reapuntados a `docs/harness-reference.md` (raíz) como
destino de su detalle — pueden aplicarse a continuación sin fricción de secuencia.
