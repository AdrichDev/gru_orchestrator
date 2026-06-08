# Verification Plan — Gru Provider Delegation Harness

| ID | Nivel | Comando / método | Criterio |
|----|-------|------------------|----------|
| V1 | Tipos | `pnpm.cmd exec tsc --noEmit` | Sin errores |
| V2 | Unit/contract | `pnpm.cmd test` | Todas las suites verdes (incl. `delegates.test.ts`) |
| V3 | Regresión simple | `pnpm.cmd gru "<prompt>"` | Flujo simple idéntico al previo |
| V4 | Regresión agentic | `pnpm.cmd gru --agentic "<prompt>"` | Pipeline agentic idéntico (UNSUPPORTED honesto) |
| V5 | Estado | `pnpm.cmd gru status` | Detección de providers sin cambios |
| V6 | Validación de operaciones | test (spy) | op incompatible → `UNSUPPORTED`, runtime no llamado |
| V7 | Honest status | test | `SUBMITTED`/`RUNNING` ≠ `COMPLETED`; `TIMEOUT` ≠ `FAILED`; `externalExecutionId` preservado |
| V8 | Registry | test | Context7/Engram no aparecen en `getAvailable()`; duplicado rechazado; sin fallback |
| V9 | Portabilidad | test (`ABSOLUTE_PATH`) | `artifacts`/`evidenceRefs` sin rutas absolutas |
| V10 | Context7 PLANNED | test | `UNAVAILABLE` con y sin `GRU_CONTEXT7_MCP`; sin docs inventadas |

## Cómo ejecutar
```powershell
pnpm.cmd exec tsc --noEmit
pnpm.cmd test
pnpm.cmd gru status
pnpm.cmd gru "buscar skill de seguridad en el catalogo awesome copilot"
pnpm.cmd gru --agentic "implement feature X"
```
