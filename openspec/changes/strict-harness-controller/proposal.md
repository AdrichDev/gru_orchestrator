# Proposal: Strict Harness Controller

## Problema

`classifyTask()` y `DelegationReport` son informativos pero no bloquean nada. Gru puede intentar ejecutar tareas críticas sin gate:
- Tareas con `viability: "needs_approval"` ejecutan sin aprobación humana.
- Tareas con `missingCapability` (e.g., nivel 3+ sin `native-subagents`) ejecutan y fallan tarde.
- El harness actual (disponibilidad real) no se consulta antes de clasificar.

## Propuesta

`StrictHarnessController` — gate pre-ejecución que:
1. Verifica disponibilidad del harness.
2. Enriquece signals con capabilities reales del harness (e.g., nivel >= 3 sin `native-subagents` → `missingCapability`).
3. Clasifica la tarea con signals enriquecidas.
4. Bloquea si `viability === "blocked"`.
5. Bloquea si `viability === "needs_approval"` y no hay `forceApproval: true`.
6. Devuelve `GateResult { allowed, classification, blockers }`.

El controller es un gate puro — no ejecuta, no delega. Decide: ¿se puede proceder?

## Alternativas descartadas

**A: Añadir gate inline en orchestrateAgenticTask()**
Descartado: mezcla clasificación con ejecución. El gate debe ser independiente y testeable.

**B: Gate basado solo en signals explícitas**
Descartado: si el harness no está disponible, el gate debe bloquearlo sin depender de que el caller sepa eso.

## Riesgos

- `forceApproval` puede ser abusado → el caller asume responsabilidad. El gate registra el bypass en blockers como informativo.
- El gate no persiste — si se quiere trazabilidad, el caller debe pasar el GateResult a `buildDelegationReport`.

## Future Scope

- Integrar gate como middleware obligatorio en `orchestrateAgenticTask()` y `orchestrateTask()`.
- CLI `pnpm gru plan "<task>"`: ejecutar gate + mostrar GateResult sin ejecutar.
- `requestApproval()` del HarnessAdapter: gate interactivo en lugar de flag.
- Minion registry: gate verifica disponibilidad real de cada minion sugerido.
