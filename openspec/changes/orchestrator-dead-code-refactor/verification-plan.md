# Verification Plan — Orchestrator Dead Code Refactor

## Required Commands

| Gate | Command | Expected Result |
|------|---------|-----------------|
| Unit tests | `pnpm test` | Passes, or unrelated pre-existing failures documented |
| Typecheck | `pnpm exec tsc --noEmit` | Passes; if blocked by TS6 `baseUrl`, document/fix separately |
| CLI status | `pnpm gru status` | Runs and reports provider states honestly |
| CLI doctor | `pnpm gru doctor` | Same behavior as status |
| Reference search | `rg "<removed-path-or-symbol>" --glob '!node_modules/**' --glob '!vendor/**' --glob '!runs/**'` | No unexpected references |
| Git review | `git diff --stat && git diff --check` | Clean diff; no whitespace errors |

## Manual Review Gates

- Confirm `vendor/awesome-copilot` and generated outputs were not changed.
- Confirm deleted candidates have inventory evidence.
- Confirm public CLI imports remain stable.
- Confirm provider delegation and agentic orchestration behavior was not intentionally changed.

## Regression Areas

- `apps/cli/src/index.ts`
- `packages/kernel/src/orchestrator/index.ts`
- `packages/kernel/src/delegates/*`
- `packages/kernel/src/adapters/*`
- `packages/shared/src/ports/*`
- `tests/*`
- `packages/kernel/src/**/__tests__/*`
