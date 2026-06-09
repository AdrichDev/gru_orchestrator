# Verification Plan: Delegation Report Output

## V1 — TypeScript

```bash
pnpm exec tsc --noEmit
```
Sin errores en `report.ts` ni `report-builder.ts`.

## V2 — Tests pasan

```bash
pnpm exec vitest run packages/kernel/src/task-router/__tests__/report-builder.test.ts
```
Todos verdes.

## V3 — Tests fallan sin lógica

Si se vacía `deriveDevilsFindings()` para devolver siempre `[]`:
- Tests R3b/R3c/R3d/R3e fallan con assertion error.

Si `approved` siempre es `true`:
- Tests R4b/R4c fallan.

## V4 — Contratos de spec

| Req | Test | Check |
|-----|------|-------|
| R1a campos | `fields present` | object has keys |
| R1b timestamp | `timestamp ISO` | toMatch regex |
| R2a resolved | `resolved delegate` | resolvedDelegate === id |
| R2b blocked | `blocked delegation` | delegationBlocked + reason |
| R3a level<2 → empty | `no findings level 1` | length 0 |
| R3b security → blocker | `security finding` | severity blocker |
| R3c irreversible → blocker | `irreversible finding` | severity blocker |
| R3d production → warning | `production finding` | severity warning |
| R3e level 4 → info | `level 4 finding` | signal "level" |
| R4a approved | `approved clean task` | true + empty blockers |
| R4b blocked delegation | `blocked delegation → unapproved` | false + blocker |
| R4c exec failed | `exec failed → unapproved` | false + blocker |
| R4d needs_approval | `needs_approval in blockers` | blockers contains NEEDS_APPROVAL |

## V5 — Sin regresión

`pnpm test` — classifier.test.ts y harness-claude.test.ts sin cambio.
