# Validation: Doble validación de spec en L3

## §T1 — Documentos raíz

**Historia**: Como Gru quiero releer la spec de un cambio L3 dos veces (self-check + devil
fresco) antes de picarla en tareas, para no arrastrar huecos de spec al código.

**Criterios de aceptación**:
- `docs/harness-reference.md` (raíz), sección `Level 3 — Large`, contiene los pasos "3c" y
  "3d" entre "spec" y "pm", con la descripción de qué hace cada uno (self-check / devil
  fresco).
- El paso 3d especifica explícitamente que es un agente distinto al `devil` del paso 2.
- `Level 4 — Critical` en el mismo archivo incluye 3c/3d antes de "human approval" (no lo
  reemplaza).
- `CLAUDE.md` (raíz), tabla compacta `WORKFLOWS BY LEVEL`, fila `3 | Large` menciona
  "3c (spec self-check) → 3d (devil re-check)"; fila `4 | Critical` menciona "→ 3c → 3d →".

**Escenario Given-When-Then**:
```gherkin
Dado un cambio clasificado como Nivel 3
Cuando Gru llega al paso "spec" y lo completa
Entonces el siguiente paso documentado es "3c: spec self-check"
Y el paso posterior es "3d: devil re-check" con un sub-agente nuevo
Y solo tras 3c/3d sin bloqueantes se avanza a "pm"
```

**Test que valida**: `grep -n "3c" docs/harness-reference.md` (raíz) → match en Level 3 y
Level 4. `grep -n "3c" CLAUDE.md` → match en la tabla compacta. Estado: 🟢.

**OK**: [x]

## §T2 — gru_orchestrator (referencia detallada)

**Historia**: Como Gru orquestando en `gru_orchestrator`, quiero que la secuencia detallada
de L3 en `docs/harness-reference.md` incluya 3c/3d, para que el harness de código y el
harness de proyecto raíz no diverjan.

**Criterios de aceptación**:
- `gru_orchestrator/docs/harness-reference.md`, sección `### Level 3 — Large` (bajo
  `Workflows by Level — Full Sequences`), incluye 3c/3d en inglés.
- `### Level 4 — Critical` en el mismo archivo, idem.
- La tabla compacta en `gru_orchestrator/CLAUDE.md` NO se modifica (sigue delegando el
  detalle a harness-reference.md).

**Test que valida**: `grep -c "3c" gru_orchestrator/docs/harness-reference.md` →
**2** matches (Level 3 + Level 4). `gru_orchestrator/CLAUDE.md` sin cambios (verificado,
no tocado en este change). Estado: 🟢.

**OK**: [x]

## §T3 — Verificación cruzada

**Historia**: Como usuario quiero confirmar que el cambio no rompió la tabla de niveles
existente (0-4) ni introdujo duplicación.

**Criterios de aceptación**:
- La tabla de niveles sigue teniendo exactamente 5 filas (0,1,2,3,4) en `CLAUDE.md` (raíz).
- No hay una segunda definición de "3c"/"3d" fuera de la sección de Level 3/4.

**Test que valida**: `grep -n "^| [0-4] |" CLAUDE.md` en la tabla `WORKFLOWS BY LEVEL` →
5 filas exactas, confirmado por lectura directa. `grep -c "3c" docs/harness-reference.md`
= **2** (Level 3 + Level 4, sin duplicación). Estado: 🟢.

**OK**: [x]

## Checklist final

- [x] T1 OK (con test 🟢)
- [x] T2 OK (con test 🟢)
- [x] T3 OK (con test 🟢)
- [x] Ningún paso de este change tocó `AGENTS.md`/`GEMINI.md` (queda para
  `canonical-docs-alignment`)

Change aplicado completo. El detalle 3c/3d vive en `docs/harness-reference.md` (raíz y
gru_orchestrator), no en los kernels — consistente con el reordenamiento hecho por
`canonical-docs-critical-audit`.
