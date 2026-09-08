# Design: extracción de referencia raíz

## Orden real de aplicación de los 5 changes de esta sesión (corregido)

```text
1. canonical-docs-critical-audit   (este) — crea docs/harness-reference.md raíz,
                                     deja CLAUDE.md raíz compacto
2. l3-spec-doublecheck             — inserta 3c/3d en docs/harness-reference.md (raíz),
                                     NO en CLAUDE.md raíz directamente
3. quality-gate-skills             — inserta trigger six-hats en el mismo doc de referencia
4. agent-browser-integration       — instala + añade mención breve en CLAUDE.md raíz
                                     (esto SÍ es kernel, es una regla corta, no detalle)
5. skills-sync-gru-orchestrator    — independiente, sin cambio de orden
6. canonical-docs-alignment        — al final: sincroniza CLAUDE.md→AGENTS.md→GEMINI.md
                                     (raíz) ya con el kernel compacto + los punteros
```

Nota: cuando se re-lean los `tasks.md` de `l3-spec-doublecheck` y `quality-gate-skills`,
sustituir "CLAUDE.md (raíz)" por "docs/harness-reference.md (raíz)" como destino del
detalle — el kernel compacto de CLAUDE.md (raíz) solo necesita una línea que apunte ahí,
igual que ya hace `gru_orchestrator/CLAUDE.md`.

## Estructura resultante de CLAUDE.md (raíz) — kernel compacto

```markdown
## WORKFLOWS BY LEVEL

| Level | Name | Key steps |
|---|---|---|
| 0 | Trivial | builder → quick validation |
| 1 | Small | filesystem → builder → light reviewer |
| 2 | Medium | filesystem → light architect → mini-spec → builder → tester → reviewer |
| 3 | Large | filesystem → architect → devil → spec → 3c → 3d → pm → builder → tester → security → reviewer → memory |
| 4 | Critical | filesystem → architect → devil → full spec → human approval → phased implementation → tester → security → reviewer → human approval → memory |

→ full sequences, rationale, and per-step detail: `docs/harness-reference.md#workflow-sequences`
```

Esto reduce las ~50 líneas inline actuales a ~10 líneas de tabla + 1 pointer — mismo nivel
de detalle accesible, menos peso en el archivo que se carga cada sesión.

## Qué NO se mueve al archivo de referencia

- Bootstrap Context (kernel real, se carga siempre — correcto que esté inline).
- Decision Table (Complexity/Risk/Resulting Level) — son 3 tablas cortas (~25 líneas
  combinadas), se quedan inline porque se consultan en CADA clasificación, no son detalle
  de referencia ocasional.
- Guardrails, Human-in-the-Loop — son reglas cortas de una línea cada una, no detalle.

Criterio de qué mover: si el contenido se consulta "cada vez" → kernel inline. Si se
consulta "solo cuando se ejecuta ese nivel específico" → referencia.
