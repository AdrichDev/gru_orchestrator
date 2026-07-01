# Proposal: Auditoría crítica de paja en documentos canónicos

## Contexto

El usuario pide explícitamente (tarea 6): evaluar los documentos canónicos con criterio
crítico, "menos es más", detectar qué está mal redactado o sobra. Este change es esa
auditoría — con hallazgos reales, no una promesa de revisarlo "algún día".

## Hallazgos (verificados con `diff`/`wc -l`/lectura directa, no supuestos)

### F1 — Duplicación de kernel en 4+ archivos, solo 3 sincronizados correctamente

Existen al menos estas copias del mismo "kernel Gru" (Bootstrap, Identity, Decision Table,
Workflows, Minion Contract, Ruflo, Memory, Guardrails, SDD, Project Intake, Scope Summary):

1. `~/.claude/CLAUDE.md` (global del usuario, fuera del repo)
2. `CLAUDE.md` (raíz del proyecto) — 500 líneas
3. `AGENTS.md` (raíz) — 542 líneas, **diverge** de (2)
4. `GEMINI.md` (raíz) — 596 líneas, **diverge** de (2)
5. `gru_orchestrator/CLAUDE.md` — 464 líneas
6. `gru_orchestrator/AGENTS.md` — idéntico a (5)
7. `gru_orchestrator/GEMINI.md` — idéntico a (5)

Solo el grupo (5)(6)(7) está correctamente sincronizado (`diff` exit 0). El grupo (2)(3)(4)
ya divergió — es la prueba viva de que mantener el mismo contenido en N archivos sin
extracción a una única fuente termina en drift. `canonical-docs-alignment` arregla (2)(3)(4)
puntualmente, pero no resuelve la causa: seguir editando 3 copias a mano vuelve a divergir
la próxima vez que alguien edite solo una.

**Recomendación**: no es una recomendación nueva — es aplicar la causa raíz. No hay fix de
proceso distinto al que ya existe (mantener las copias idénticas); el riesgo se acepta
porque los 3 nombres de archivo son un requisito de cada CLI (Claude Code lee CLAUDE.md,
Codex lee AGENTS.md, Gemini CLI lee GEMINI.md) — no se puede tener un solo archivo. Mitigación
real: un check de CI/script (`diff CLAUDE.md AGENTS.md && diff CLAUDE.md GEMINI.md`) que
falle si divergen — proponer como tarea, no aplicar código sin aprobación aparte.

### F2 — Root CLAUDE.md no extrae detalle a un archivo de referencia (gru_orchestrator sí)

`gru_orchestrator/CLAUDE.md` practica ya el patrón correcto: el kernel es compacto y dice
"→ full provider sequences per level: `docs/harness-reference.md#workflow-sequences`" en
vez de inlinear las 5 secuencias completas. Root `CLAUDE.md` NO hace esto: inlinea las 5
secuencias completas de Level 0-4 directamente en el archivo que se carga cada sesión
(~50 líneas de las 500 totales — 10% del archivo es detalle que podría vivir en un
`docs/`).

**Esto es el hallazgo de mayor impacto para "menos es más"**: root ya tiene el ejemplo de
cómo hacerlo bien a un nivel de carpeta (`gru_orchestrator/`) — solo falta aplicar el mismo
patrón un nivel arriba, antes de que crezca más (los changes 1-4 de esta sesión van a
añadir texto a exactamente esas secciones de workflow).

### F3 — "PROTOCOL: SCOPE SUMMARY" se repite verbatim en varios archivos

El bloque de formato caveman de resumen de scope (`SCOPE [name] DONE. LEVEL:... PROVIDERS:
... PROCEDURE:...`) aparece con el mismo texto en el kernel global, en root CLAUDE.md, y en
`gru_orchestrator/CLAUDE.md`. Es un formato de salida, no una decisión de arquitectura por
nivel de carpeta — candidato ideal a vivir en un solo lugar (`docs/` o `_shared/`) y ser
referenciado, no copiado.

### F4 — Los changes 1-4 de esta sesión, si se aplican tal cual, agravan F2

`l3-spec-doublecheck` añade texto a las 5 secuencias inlineadas. `quality-gate-skills`
añade el trigger de six-hats en la misma zona. Si F2 no se resuelve ANTES, cada nuevo
change hace crecer el archivo de 500 líneas en vez de crecer un `docs/harness-reference.md`
nuevo a nivel raíz.

## Propuesta de acción

1. **Antes** de aplicar `canonical-docs-alignment`: crear `docs/harness-reference.md` a
   nivel RAÍZ (mismo patrón que `gru_orchestrator/docs/harness-reference.md`), mover ahí
   las 5 secuencias completas de Level 0-4 y el detalle de Project Intake que hoy están
   inline en `CLAUDE.md` (raíz).
2. Root `CLAUDE.md` queda con la tabla compacta (kernel) + pointer a
   `docs/harness-reference.md#workflow-sequences`, exactamente como
   `gru_orchestrator/CLAUDE.md` ya hace.
3. Los changes `l3-spec-doublecheck` y `quality-gate-skills` insertan su detalle (3c/3d,
   trigger six-hats) en `docs/harness-reference.md` (raíz), no en el kernel compacto —
   ajustar sus `tasks.md` si ya se aplicaron apuntando al archivo viejo.
4. NO tocar el contenido semántico de ningún archivo en esta auditoría — solo mover/
   extraer, cero reescritura de reglas. Esto es refactor de estructura, no de contenido.

## Riesgos

- Mover contenido de sitio puede romper referencias externas (otros documentos que citen
  una sección de `CLAUDE.md` por nombre de encabezado). Mitigación: `grep -rn` de cada
  encabezado movido antes de mover, actualizar citantes.
- Este change reordena algo que los changes 1, 3, 5 de esta sesión también tocan — debe
  aplicarse ANTES de esos 3 (no después), invirtiendo el orden de dependencia que
  `canonical-docs-alignment` asumía. Ver design.md.

## Dependencias

Este change debe aplicarse ANTES de `l3-spec-doublecheck`, `quality-gate-skills` y
`canonical-docs-alignment` (invierte el orden — es una corrección de secuencia respecto a
lo escrito en esos 3 proposals, que asumían root `CLAUDE.md` como está hoy).
