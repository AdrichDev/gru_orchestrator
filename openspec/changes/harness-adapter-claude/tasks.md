# Tasks: Claude Harness Adapter

## T1 — Implementación

- [x] Crear `packages/kernel/src/adapters/harness-claude.ts`
  - `ClaudeHarnessAdapter implements HarnessAdapter`
  - Constructor injection: `_detect: () => string = detectHarness`
  - `CLAUDE_CAPABILITIES` array estático
  - `checkAvailability()`, `supports()`, `getContext()`, `execute()`

## T2 — Tests reales

- [x] Crear `packages/kernel/src/adapters/__tests__/harness-claude.test.ts`
  - R1a: detect "claude" → ready
  - R1b: detect "standalone" → unsupported + reason menciona harness
  - R2a-R2d: file-tools, native-subagents, code-execution, web-search → true
  - R2e: memory → false
  - R2f: approval-flow → false
  - R3a: getContext → harness "claude", modelControl "host-managed", capabilities correctas
  - R4a: execute cuando available → success true, runtimeMode "host-managed"
  - R4b: execute cuando unavailable → success false, HARNESS_UNAVAILABLE
  - R5a: id === "claude"

## T3 — Verificación final

- [x] `pnpm exec tsc --noEmit` — solo warning pre-existente de baseUrl, sin errores nuestros
- [x] `pnpm test` — **28/28 verdes**, sin regresión
