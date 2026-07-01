# Proposal: Doble validación de spec en L3 (pasos 3c/3d)

## Problema

L3 hoy: `filesystem → architect → devil → spec → pm → builder → tester → security → reviewer → memory`.

El paso 3 ("spec") se escribe y pasa directo a "pm" (paso 4). Nadie relee la spec ya escrita
antes de picarla en tareas. Si la spec tiene un hueco, el hueco se hereda en tasks, builder,
tester — se detecta tarde, cuando ya hay código.

El usuario pide (tarea 3 de esta sesión) que se valide "varias veces, antes de implementar
código y una vez planteado, para ver si esa es la mejor [solución]". Hoy solo hay una pasada
de `devil` — y ocurre ANTES de escribir la spec, no después.

## Propuesta

Insertar dos sub-pasos entre "spec" (3) y "pm" (4) en el workflow L3:

- **3c — Self-check de spec**: quien escribió la spec (`minion-spec` / `gentlePi`) la relee
  contra el problema original: ¿cubre todos los casos del Filesystem Scan? ¿hay requirement
  sin escenario Given-When-Then? ¿algo se coló que no estaba en el problema? Salida:
  spec corregida o confirmada sin cambios.
- **3d — Segunda pasada devil's advocate sobre la spec escrita**: `devil` (no el mismo que
  auditó la propuesta en el paso 2) relee la spec YA ESCRITA — no la idea abstracta — y
  busca: alternativas descartadas sin justificar, riesgos no mencionados en el Devil Check
  de la spec, requirements que suenan a "cómo" en vez de "qué". Si encuentra bloqueante,
  vuelve a 3 (rewrite). Si no, pasa a 4 (pm).

Regla: 3c y 3d son obligatorios en L3 y L4. En L2 son opcionales (mini-spec ligera, el costo
de doble-pasada no compensa). En L0/L1 no aplican (no hay spec formal).

## Alternativas descartadas

**A — Fusionar 3c en el paso "spec" mismo (sin numerarlo aparte)**
Descartado: si no es un paso visible en el workflow, se salta bajo presión de tiempo. Nombrar
el paso lo hace auditable en el resumen caveman de scope (`PROCEDURE: [pasos reales]`).

**B — Repetir el mismo `devil` de paso 2 en 3d**
Descartado: el mismo agente que aprobó la idea tiene sesgo de confirmación sobre su propia
spec. 3d debe ser una revisión con contexto fresco (nuevo sub-agente, ver
`docs/harness-reference.md#minion-catalog` — dedup de lanzamientos por `(phase, fingerprint)`
ya lo exige).

**C — Six Thinking Hats como sustituto de 3c/3d**
Evaluado en `quality-gate-skills` (change hermano). No sustituye a 3c/3d: Six Hats es para
decisiones de diseño con trade-offs abiertos (Nivel 3-4, fase architect/devil), 3c/3d es un
gate mecánico sobre la spec ya redactada. Son complementarios, no alternativos.

## Riesgos

- Añade 1-2 rondas de lectura antes de picar tareas → coste de tiempo en L3/L4. Aceptado:
  el usuario pidió explícitamente esta doble validación; el coste de un bug de spec detectado
  en builder/tester es mayor.
- Si 3d encuentra bloqueante y se repite el ciclo demasiadas veces → señal de que el
  problema original (paso 1-2) estaba mal entendido, no que 3c/3d fallen. Mitigación:
  si 3d rebota 2 veces la misma spec, escalar a Ruflo CONSULT.

## Alcance de archivos a tocar

- `CLAUDE.md` (raíz) — sección `WORKFLOWS BY LEVEL` → `Level 3 — Large`.
- `gru_orchestrator/CLAUDE.md` — sección `WORKFLOWS BY LEVEL — COMPACT SUMMARY` (referencia
  compacta) — no necesita el detalle 3c/3d, solo debe seguir apuntando a
  `docs/harness-reference.md#workflow-sequences`.
- `gru_orchestrator/docs/harness-reference.md` — sección `### Level 3 — Large` bajo
  `Workflows by Level — Full Sequences` (aquí va el detalle completo de 3c/3d).
- Propagar a `AGENTS.md` / `GEMINI.md` se resuelve en el change `canonical-docs-alignment`
  (dependencia downstream, no se toca aquí para no duplicar trabajo).

## Dependencias

Ninguna. Es la primera pieza; `canonical-docs-alignment` la absorbe después.
