# Verification Plan: Claude Harness Adapter

## V1 — TypeScript

```bash
pnpm exec tsc --noEmit
```
Sin errores en `harness-claude.ts`. `ClaudeHarnessAdapter` asignable a `HarnessAdapter`.

## V2 — Tests pasan

```bash
pnpm exec vitest run packages/kernel/src/adapters/__tests__/harness-claude.test.ts
```
Todos verdes.

## V3 — Tests fallan sin lógica

Si se comenta el cuerpo de `checkAvailability()` para que siempre devuelva `{ status: "ready" }`:
- Test R1b (`standalone → unsupported`) falla con assertion error.

Si se agrega `"memory"` a `CLAUDE_CAPABILITIES`:
- Test R2e (`memory → false`) falla.

## V4 — Contratos de spec

| Req | Test | Check |
|-----|------|-------|
| R1a detect claude → ready | `detect "claude" → ready` | `status === "ready"` |
| R1b detect other → unsupported | `detect "standalone" → unsupported` | `status === "unsupported"` + reason |
| R2a file-tools | `supports file-tools → true` | `toBe(true)` |
| R2b native-subagents | `supports native-subagents → true` | `toBe(true)` |
| R2e memory | `supports memory → false` | `toBe(false)` |
| R3a getContext | `getContext harness+capabilities` | object match |
| R4a execute available | `execute when ready` | success+runtimeMode |
| R4b execute unavailable | `execute when unsupported` | error.code |
| R5a id | `id === "claude"` | exact |

## V5 — Sin regresión

`pnpm test` — tests de delegates.test.ts y classifier.test.ts sin cambio.
