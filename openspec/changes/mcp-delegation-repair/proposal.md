# Proposal: MCP Delegation Repair

## Problema

Cuatro issues MCP detectados en el sistema Gru:

**Issue 1 — Config MCP (R1, R2) — ya resuelto en código, falta validación automática**

`.mcp.json` usa `pnpm dlx ruflo@latest mcp start` (correcto) y `.claude/settings.json` lista herramientas explícitas (correcto), pero no existe ningún test que evite regresión silenciosa.

**Issue 2 — Context7Delegate deshonesto (R3)**

`Context7Delegate.detect()` siempre devuelve `UNAVAILABLE + PLANNED` aunque `.mcp.json` tiene context7 configurado. Esto significa que Gru nunca intenta delegar documentación a Context7 incluso cuando el servidor MCP está disponible.

**Issue 3 — Delegación compleja sin registry (R4)**

`orchestrateAgenticTask()` hardcodea `rufloAdapter` para executor/reviewer/tester. No usa `createDelegationRegistry()`. Si la tarea requiere un provider distinto (ecc para security, context7 para docs), no hay selección por capacidad — Ruflo lo intenta todo o falla silenciosamente.

## Propuesta

### R1 + R2 — Tests de configuración
Tests unitarios que validan `.mcp.json` y `.claude/settings.json` como contrato de configuración. Protege contra regresión.

### R3 — Context7 honest detection
`Context7Delegate.detect()` hace probe real:
1. Lee `.mcp.json` para localizar el comando context7.
2. Spawns el proceso MCP y envía `initialize` JSON-RPC.
3. `AVAILABLE + READY` si responde; `UNAVAILABLE + READY` si no responde; `UNAVAILABLE + PLANNED` si no está configurado.

`execute()` devuelve `UNAVAILABLE` si no hay MCP activo — nunca fabrica documentación.

### R4 — Delegation registry en agentic pipeline
`orchestrateAgenticTask()` acepta `operation?: string`. Cuando se pasa:
1. Llama `createDelegationRegistry()` para construir el registry.
2. Llama `resolveDelegate(operation, registry)` → delegate seleccionado o BLOCKED.
3. Si BLOCKED → `PlanResult` con causa accionable, sin fallback silencioso.
4. Si delegate = ruflo → pipeline agentic existente (backward compat).
5. Si delegate ≠ ruflo → usa delegation layer directamente (ecc, context7, etc.).

## Alternativas descartadas

**A: Mock del MCP en tests de Context7**
Descartado: los mocks de spawn son frágiles y no verifican el protocolo real. Mejor: inyección de dependencias (readConfig + probe functions).

**B: Fallback silencioso a Ruflo cuando el delegate falla**
Descartado: viola el contrato "no fallback silencioso". Si context7 falla, Gru bloquea con causa, no inventa docs.

**C: Reescribir pipeline agentic completo para usar delegation layer**
Descartado: scope excesivo. El pipeline Ruflo funciona; sólo necesita guardia de delegation registry cuando `operation` es explícito.

## Riesgos

- Context7 probe tarda hasta 3s (npx download en primera ejecución) → aceptable, es detección lazy.
- `createDelegationRegistry()` instancia todos los providers → su coste es startup, no per-request.
- Tests de config leen ficheros reales del repo → acoplamiento intencional (son contratos de configuración).
