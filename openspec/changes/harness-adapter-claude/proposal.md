# Proposal: Claude Harness Adapter

## Problema

`detectHarness()` en `runtime/harness.ts` hace detección best-effort por env vars pero no es autoritativa.
`HarnessAdapter` interface existe en `ports/harness.ts` sin ninguna implementación.

Resultado: `classifyTask()` puede devolver `missingCapability` para señales que Claude Code sí soporta, pero nadie puede verificarlo programáticamente. Gates de viabilidad son ciegos al entorno real.

## Propuesta

Implementar `ClaudeHarnessAdapter` que:
1. Detecta si el harness activo es Claude (via env var injection).
2. Reporta capabilities estáticas de Claude Code: `file-tools`, `native-subagents`, `code-execution`, `web-search`, `streaming`.
3. Implementa `execute()` como host-managed passthrough (Claude IS el executor).
4. Usa constructor injection para testabilidad (no depende de env vars reales en tests).

## Alternativas descartadas

**A: Expandir detectHarness() con más heurísticas**
Descartado: detectHarness ya existe. El problema es que no hay un HarnessAdapter que lo consuma de forma estructurada.

**B: Implementar capabilities dinámicas (probe real de cada tool)**
Descartado: Fuera de scope. Claude Code siempre tiene file-tools y Agent. La detección dinámica es para `StrictHarnessController` (futuro).

## Riesgos

- Claude versiones futuras pueden cambiar qué tools están disponibles. Las capabilities son estáticas en esta fase → riesgo bajo, fácil de actualizar.
- `execute()` como passthrough no ejecuta código real → correcto, Claude IS el harness, Gru no invoca Claude desde dentro de Claude.

## Future Scope

- `StrictHarnessController`: usar `ClaudeHarnessAdapter.supports()` como gate en `classifyTask()` para `missingCapability` automático.
- `approval-flow` capability: cuando Claude Code tenga `requestApproval` wired.
- `memory` capability: detectar engram disponible dinámicamente.
- Adapters para otros harnesses: codex, gemini, standalone.
