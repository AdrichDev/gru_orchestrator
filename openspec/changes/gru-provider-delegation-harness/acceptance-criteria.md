# Acceptance Criteria — Gru Provider Delegation Harness

| # | Criterio | Estado |
|---|----------|--------|
| AC1 | `GruProvider` (simple) no se renombra | ✅ |
| AC2 | `ProviderAdapter` (agentic) no se sustituye | ✅ |
| AC3 | `ProviderDelegate` actúa como fachada (no nuevo runtime) | ✅ |
| AC4 | Cada provider declara y valida operaciones compatibles | ✅ |
| AC5 | AwesomeCopilot no es ejecutor genérico (solo skill/catalog) | ✅ |
| AC6 | Engram no es ejecutor genérico (solo memory.*) | ✅ |
| AC7 | Context7 no inventa documentación; PLANNED/UNAVAILABLE toda la fase | ✅ |
| AC8 | `SUBMITTED`/`RUNNING` ≠ `COMPLETED`; `TIMEOUT` ≠ `FAILED` | ✅ |
| AC9 | Sin fallback silencioso; duplicados rechazados | ✅ |
| AC10 | Sin rutas absolutas como referencias canónicas persistidas | ✅ |
| AC11 | Flujos simple y agentic siguen funcionando (sin regresión) | ✅ |
| AC12 | TypeScript compila (`tsc --noEmit`) | ✅ |
| AC13 | Todos los tests pasan | ✅ (83/83) |
| AC14 | Registry expone solo delegates AVAILABLE | ✅ |

## Definition of Done (Fase 0 + Fase 1)
- Artefactos OpenSpec creados y coherentes con la implementación.
- Port de delegación + 9 delegates + registry + tabla de capacidades.
- Tests de contrato cubren operaciones, estados, registry, portabilidad, Context7.
- `tsc` limpio; `pnpm test` verde; flujos existentes intactos.
- Fase 2+ explícitamente fuera de alcance.
