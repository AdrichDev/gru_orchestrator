# Proposal: Task Classification Service

## Problema

`routeTask()` solo hace keyword scoring para elegir provider. No hay:
- Cálculo de complejidad estructural (archivos, dominios, nueva arquitectura).
- Cálculo de riesgo operacional (irreversibilidad, producción, seguridad).
- Modelo de viabilidad explícito: ¿se puede ejecutar ahora o necesita aprobación?
- `DelegationDecision` estructurado: quién ejecuta, por qué, qué gates aplican.

El resultado es que Gru puede intentar ejecutar tareas críticas sin justificación ni gates, y puede fallar silenciosamente sin indicar qué falta.

## Propuesta

Añadir un `classifyTask()` service encima del routing existente:

1. **`ClassificationSignals`** — señales explícitas + inferidas del prompt.
2. **`scoreComplexity(signals)`** — puntuación 0-10 basada en archivos, dominios, arquitectura, dependencias.
3. **`scoreRisk(signals)`** — puntuación 0-15 basada en irreversibilidad, producción, seguridad, datos.
4. **`levelFromScore(total)`** — nivel 0-4 (Trivial → Critical).
5. **`resolveViability(signals, riskScore)`** — `ready | blocked | needs_approval | unsupported`.
6. **`TaskClassification`** — resultado completo: nivel, riesgo, viabilidad, minion activo, gates requeridos.
7. **`inferSignalsFromPrompt(prompt)`** — heurística para detectar señales de riesgo sin filesystem scan.

## Minion vocabulary

"Minion" es el nombre Gru para agentes/subagentes reales. Cada minion mapea a:
- `minion-filesystem` → HarnessAdapter file-tools
- `minion-architect` → gentlePi / local provider
- `minion-builder` → ruflo / local provider
- `minion-reviewer` → ruflo reviewer agent
- `minion-tester` → ruflo tester agent
- `minion-devil` → devilsAdvocate persona
- `minion-security` → ecc provider
- `minion-docs` → context7 delegate
- `minion-mcp` → mcp capability check
- `minion-memory` → engram provider

## Alternativas descartadas

**A: Expandir keyword scoring en routeTask()**
Descartado: mezcla routing con clasificación. Las responsabilidades son distintas.

**B: Detección solo por filesystem scan**
Descartado: filesystem scan requiere I/O real. El classifier debe funcionar con señales explícitas más heurística de prompt.

**C: Usar HarnessAdapter para viabilidad**
Descartado: HarnessAdapter no está implementado aún. Viabilidad se calcula con señales conocidas, no depende de runtime.

## Riesgos

- Heurística de prompt puede dar falsos positivos en detectar señales de riesgo → conservador por diseño (falso positivo es más seguro que falso negativo).
- La viabilidad es informativa, no bloqueante en esta fase. Bloqueo real viene en fases siguientes (StrictHarnessController).

## Future Scope (post esta fase)

- `StrictHarnessController`: usar `TaskClassification` como gate obligatorio antes de ejecutar.
- `DelegationReport`: output estructurado por tarea con devils_advocate_findings.
- `HarnessAdapter` para claude: implementar la interfaz real con `detectHarness()`.
- CLI `pnpm gru plan "<task>"`: mostrar clasificación antes de ejecutar.
- Minion registry: mapeo formal minion → provider/harness con check de disponibilidad.
