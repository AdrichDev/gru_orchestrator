# Verification Plan: MCP Delegation Repair

## V1 — R1: MCP startup válido

| Check | Método | Criterio pass |
|-------|--------|---------------|
| `.mcp.json` `claude-flow.command` | Test automático `config.test.ts` | `=== "pnpm"` |
| `.mcp.json` `claude-flow.args[0]` | Test automático | `=== "dlx"` |
| `.mcp.json` `claude-flow.args` contiene ruflo | Test automático | `.join(" ")` contiene `"ruflo"` |
| No usa `npx` para claude-flow | Test automático | `command !== "npx"` AND args no contienen `"npx"` |

## V2 — R2: Claude permissions válidas

| Check | Método | Criterio pass |
|-------|--------|---------------|
| Sin wildcard `mcp__*:*` | Test automático `config.test.ts` | `filter(/mcp__.*:\*$/).length === 0` |
| Herramientas explícitas | Inspección visual | Cada rule MCP es `mcp__claude-flow__<tool>` |
| Formato válido | Test automático | Regex `/^mcp__[a-z-]+__[a-z_-]+$/` sobre cada rule MCP |

## V3 — R3: Context7 honesto

| Check | Método | Criterio pass |
|-------|--------|---------------|
| Sin config → UNAVAILABLE + PLANNED | Test unit (inyección `() => null`) | `status === "UNAVAILABLE"`, `integration === "PLANNED"` |
| Config + probe fail → UNAVAILABLE + READY | Test unit (inyección `async () => false`) | `status === "UNAVAILABLE"`, `integration === "READY"` |
| Config + probe OK → AVAILABLE + READY | Test unit (inyección `async () => true`) | `status === "AVAILABLE"`, `integration === "READY"` |
| execute UNAVAILABLE → no output | Test unit | `res.output === undefined` |
| execute op no soportada → UNSUPPORTED | Test unit | `res.status === "UNSUPPORTED"`, runtime no invocado |
| getAvailable() excluye Context7 UNAVAILABLE | Test unit (registry) | `ids` no contiene `"context7"` |

## V4 — R4: Delegación por capacidades

| Check | Método | Criterio pass |
|-------|--------|---------------|
| `resolveDelegate` op soportada → blocked=false | Test unit | `resolution.blocked === false` |
| `resolveDelegate` op no soportada → blocked=true | Test unit | `resolution.blocked === true`, reason contiene op |
| `orchestrateAgenticTask` BLOCKED → PlanResult blocked | Test unit | `approved === false`, `blockers[0]` contiene `"delegation:BLOCKED"` |
| Sin `operation` → pipeline existente inalterado | Test (backward compat) | Mismo comportamiento que antes del cambio |
| No se invoca runtime cuando BLOCKED | Test unit (spy) | Ningún spy de execute() fue llamado |

## V5 — Verificación de regresión

| Check | Comando | Criterio pass |
|-------|---------|---------------|
| TypeScript compila | `pnpm exec tsc --noEmit` | Exit 0, 0 errores |
| Tests unitarios | `pnpm test` | 0 fallos |
| Pipeline simple | `pnpm gru "<prompt>"` | Resultado con provider elegido |
| Pipeline agentic | `pnpm gru "<prompt>" --agentic` | Gates evaluados, no self-approval |
| Status | `pnpm gru status --strict` | Sin errores de config |
