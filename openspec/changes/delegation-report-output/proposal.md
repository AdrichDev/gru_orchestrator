# Proposal: Delegation Report Output

## Problema

Después de ejecutar una tarea, no hay un artefacto estructurado que capture:
- Qué clasificación se asignó y por qué.
- Qué delegate ejecutó (o por qué fue bloqueada la delegación).
- Qué devil's advocate encontró.
- Si la tarea fue aprobada o bloqueada, y por qué.

El resultado es que `orchestrateAgenticTask()` devuelve `PlanResult` (artefacto del pipeline agentic) pero no hay un `DelegationReport` que ligue clasificación + delegación + devil + ejecución en un solo objeto trazable.

## Propuesta

1. **`DelegationReport`** — tipo público que agrega clasificación, delegación, ejecución y devil's findings.
2. **`DevilsFinding`** — hallazgo individual del devil's advocate: severity + signal + message.
3. **`buildDelegationReport()`** — función pura (sin I/O) que construye el reporte desde sus partes.
4. **`deriveDevilsFindings()`** — genera devil's findings automáticamente desde `TaskClassification`.

## Alternativas descartadas

**A: Añadir campos a PlanResult**
Descartado: PlanResult pertenece al pipeline agentic (ruflo). DelegationReport es ortogonal — aplica también a delegaciones síncronas y bloqueadas que nunca llegan al pipeline.

**B: Log estructurado en runs/**.json**
Descartado: ya existe pero no es un tipo exportado consumible programáticamente.

## Riesgos

- Devil's findings automáticos pueden ser verbosos. Son informativos, no bloquean en esta fase.
- `approved` en DelegationReport es informativo — el bloqueo real es responsabilidad de StrictHarnessController (futuro).

## Future Scope

- StrictHarnessController: usar DelegationReport.approved como gate real antes de ejecutar.
- CLI `pnpm gru plan "<task>"`: mostrar DelegationReport sin ejecutar.
- Persistir DelegationReport en engram para trazabilidad histórica.
