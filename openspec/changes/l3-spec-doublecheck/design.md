# Design: Doble validación de spec en L3

## Texto exacto a insertar

En `CLAUDE.md` (raíz), dentro de `### Level 3 — Large`, sustituir:

```text
filesystem (already run)
→ architect
→ devil
→ spec
→ pm
→ builder by units
→ tester
→ security if applicable
→ reviewer
→ memory
```

por:

```text
filesystem (already run)
→ architect
→ devil
→ spec
→ 3c: spec self-check (autor de la spec relee contra Filesystem Scan + problema original)
→ 3d: devil re-check (agente NUEVO relee la spec ya escrita, no la idea; busca alternativas
       sin justificar, riesgos no listados, requirements que describen "cómo" en vez de "qué";
       bloqueante → vuelve a "spec")
→ pm
→ builder by units
→ tester
→ security if applicable
→ reviewer
→ memory
```

En `gru_orchestrator/docs/harness-reference.md`, sección `### Level 3 — Large` (bajo
`Workflows by Level — Full Sequences`), mismo patrón adaptado al inglés/formato del archivo:

```text
local provider (filesystem scan)
→ gentlePi provider (SDD: specs, tasks, and design)
→ 3c: spec self-check — spec author re-reads spec against Filesystem Scan findings
→ 3d: devil re-check — fresh sub-agent re-reads the WRITTEN spec (not the idea);
       blocking finding → back to spec step
→ devilsAdvocate persona (deep risk assessment)
→ local or ruflo provider (for distributed code implementation)
→ pnpm test (run unit/integration tests)
→ ecc provider (security audit and CVE)
→ engram provider (save architectural decisions)
```

## Regla de nivel

- L0/L1: no aplica (no hay spec formal que revisar).
- L2: opcional — el mini-spec de L2 (`Explore → Mini-spec → Apply → Verify`) puede saltarse
  3c/3d si el propio autor ya hizo self-check inline; queda a discreción de Gru, sin bloquear.
- L3/L4: obligatorio. Si se salta, el resumen de scope (`PROCEDURE:`) debe decir por qué
  (ej. "3c/3d omitido: spec trivial de 1 archivo, sin riesgo") — igual que la regla existente
  de "si scope fue PARTIAL → indicar PARTIAL + razón".

## Registro en Engram

Cuando 3d rebota una spec (bloqueante encontrado), guardar:

```text
KEY:   project:[name]:workflows:l3-spec-rebote-[short-id]
VALUE: [qué encontró 3d, por qué la spec original no lo cubría]
LEVEL: 3 (o 4)
```

Esto alimenta futuras sesiones: si el mismo tipo de hueco se repite, es señal de que
"architect" (paso 1) necesita un checklist adicional, no que 3c/3d estén de más.
