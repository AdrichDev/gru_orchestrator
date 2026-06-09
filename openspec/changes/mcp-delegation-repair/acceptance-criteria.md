# Acceptance Criteria: MCP Delegation Repair

## AC-R1 — MCP startup válido

- [ ] `pnpm test` pasa el test `config.test.ts > .mcp.json claude-flow uses pnpm dlx`
- [ ] `pnpm test` pasa el test `config.test.ts > .mcp.json does not use npx for claude-flow`

## AC-R2 — Claude permissions válidas

- [ ] `pnpm test` pasa el test `config.test.ts > settings.json has no wildcard MCP allow rules`
- [ ] `pnpm test` pasa el test `config.test.ts > settings.json MCP rules follow explicit format`

## AC-R3 — Context7 honesto

- [ ] `pnpm test` pasa todos los tests del bloque `Context7 delegate` en `delegates.test.ts`
- [ ] Test "detect() sin config → UNAVAILABLE + PLANNED" pasa
- [ ] Test "detect() config + probe fail → UNAVAILABLE + READY" pasa
- [ ] Test "detect() config + probe OK → AVAILABLE + READY" pasa
- [ ] Test "execute UNAVAILABLE → output undefined" pasa
- [ ] Test "execute op no soportada → UNSUPPORTED" pasa
- [ ] Test de registry: context7 UNAVAILABLE excluido de `getAvailable()` pasa

## AC-R4 — Delegación por capacidades

- [ ] `pnpm test` pasa todos los tests de `resolveDelegate` en `delegates.test.ts`
- [ ] `pnpm test` pasa tests de `orchestrateAgenticTask` con operation
- [ ] `resolveDelegate("documentation.search", registry)` devuelve `blocked: false` cuando context7 AVAILABLE
- [ ] `resolveDelegate("xyz.unknown", registry)` devuelve `blocked: true` con reason accionable
- [ ] `orchestrateAgenticTask(prompt, phase, sddId, "xyz.unknown")` devuelve `approved: false` + `"delegation:BLOCKED"` en blockers

## AC-Regresión

- [ ] `pnpm exec tsc --noEmit` → exit 0
- [ ] `pnpm test` → 0 fallos (todos los tests existentes siguen pasando)
- [ ] `orchestrateAgenticTask(prompt, "apply")` sin `operation` → mismo comportamiento que antes
- [ ] Pipeline `--agentic` conserva gates y no self-approval

## Definición de Done

El cambio está DONE cuando:
1. Todos los AC-R1 a AC-Regresión marcados como pasan.
2. `pnpm exec tsc --noEmit` → exit 0.
3. `pnpm test` → 0 fallos.
4. Ningún test nuevo usa mocks de runtime (spawn real, no simulado en tests de config).
5. Ningún path devuelve `output` con documentación fabricada desde `Context7Delegate`.
