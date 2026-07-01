# Proposal: Gate de calidad multi-pasada (pre-código y post-plan)

## Problema

El usuario pide (tarea 3): "que se valide varias veces que se revise tanto antes de
implementar el código como una vez planteado, para verificar si esa es la mejor [solución]".
Motivo explícito: "código que funcione no tiene por qué ser código óptimo ni el mejor código
posible" — quiere estructura, escalabilidad y buenas prácticas, no solo "pasa los tests".

Estado actual del catálogo de skills (`.claude/skills/`, 74 dirs en raíz / 58 en
`gru_orchestrator`):
- `devil` (persona built-in) = una sola pasada de riesgo/bloqueo, ANTES de escribir spec.
- `l3-spec-doublecheck` (change hermano, ya creado) = self-check + devil fresco SOBRE la
  spec ya escrita, entre spec y pm.
- `judgment-day` = dual review ciego + fix + re-juzgar. Post-código.
- `verification-quality` = truth scoring + rollback automático. Post-código.
- `code-review` (skill unscoped raíz) = revisión de diff por bugs/simplificación. Post-código.
- Ninguna skill cubre: comparar explícitamente MÚLTIPLES alternativas de diseño antes de
  elegir una, más allá del riesgo (`devil` solo mira Black Hat: qué puede salir mal).

Gap real: falta una pasada de **exploración de alternativas** (¿es esta la mejor solución
entre las posibles, no solo la que no explota?) en la fase de `architect`, antes de llegar
a `spec`.

## Propuesta

### 1. Six Thinking Hats — SÍ, pero acotado (no para todo)

Crear skill local `six-hats-review` (De Bono: White=datos, Red=riesgo/instinto,
Black=crítica, Yellow=beneficios, Green=alternativas creativas, Blue=proceso/síntesis).

**Trigger**: solo en el paso `architect` de L3/L4, y solo cuando la tabla de complejidad
marcó "Requires new architecture" (2 pts) o hay 2+ alternativas de diseño viables sobre
la mesa. NO se activa en L0-L2 ni en tareas con una sola solución obvia — eso sería la
"paja" que el propio usuario pide evitar (tarea 6).

Relación con `devil` existente: `devil` YA cubre Black Hat (riesgo/bloqueo). Six Hats no
lo duplica — añade las 5 perspectivas que `devil` no cubre (datos, beneficios, alternativas,
síntesis). Se ejecuta ANTES de `devil`, en la misma fase de `architect`, y su salida
(alternativas comparadas) es lo que `devil` audita después.

Workflow L3/L4 actualizado (fase 1-2):
```text
architect → [si nueva arquitectura o 2+ alternativas: six-hats-review] → devil → spec → 3c → 3d → pm...
```

### 2. Adoptar 2 skills de `vendor/awesome-copilot/skills/` (Apache-2.0, sin restricción)

- **`quality-playbook`**: audit de calidad con revisión de 3 pasadas + "Council of Three"
  (multi-model spec audit) + bug report consolidado con parches TDD-verificados. Encaja
  directo con "código óptimo, no solo funcional". Uso: gate opcional en `reviewer` (paso
  final de L3/L4), NO en cada L1/L2 — es pesado, se reserva para cambios grandes.
- **`create-architectural-decision-record`**: plantilla de ADR. Encaja con el paso
  `architect` + el hábito ya existente de Engram (`architecture:[module]`). En vez de
  guardar solo una línea en Engram, el ADR completo se referencia desde Engram.

### 3. NO adoptar (evaluados y descartados)

- `doublecheck`: verificación de claims factuales con fuentes web — para contenido legal/
  factual, no para código. Fuera de scope.
- `eyeball`: análisis de documentos con capturas — no aplica a código.
- `review-and-refactor`, `structured-autonomy-plan/implement/generate`: redundantes con
  `code-review`/`simplify` y con el propio flujo SDD (`sdd-explore`→`sdd-propose`→
  `sdd-design`→`sdd-tasks`→`sdd-apply`→`sdd-verify`) que ya existe. Adoptarlos duplicaría
  sin añadir valor — exactamente el tipo de "paja" que la tarea 6 pide evitar.

## Riesgos

- Six Hats mal acotado (activado siempre) → ralentiza cada tarea trivial. Mitigación: el
  trigger está atado a la señal EXISTENTE "Requires new architecture" de la tabla de
  complejidad — no es un criterio nuevo e inventado, es el mismo criterio que ya sube el
  nivel de 0 a 2 puntos.
- `quality-playbook` es una skill de 2738 líneas (SKILL.md) — pesada de cargar en contexto.
  Mitigación: se referencia por ruta (`vendor/awesome-copilot/skills/quality-playbook/`),
  no se copia entera al catálogo local; se invoca solo en `reviewer` de L3/L4 cuando el
  cambio es grande (4+ archivos).

## Dependencias

Depende de `l3-spec-doublecheck` (ya define dónde entra 3c/3d; Six Hats se ubica ANTES,
en `architect`, no lo pisa). Alimenta `canonical-docs-alignment` (el texto final de
workflow L3/L4 debe incluir esto también).
