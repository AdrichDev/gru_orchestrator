# Spec: MCP Delegation Repair

## R1 — MCP startup válido

**Given** repo con `devEngines.packageManager = pnpm` en `package.json`  
**And** `claude-flow` server definido en `.mcp.json`  
**When** se lanza el servidor Ruflo MCP  
**Then** el campo `command` es `pnpm` y `args[0]` es `dlx`  
**And** `args[1]` contiene `ruflo`  
**And** no aparece `npx` en el comando ni en los args de `claude-flow`

---

## R2 — Claude permissions válidas

**Given** `.claude/settings.json`  
**Then** no existe ninguna allow rule que siga el patrón `mcp__*:*`  
**And** cada herramienta MCP de claude-flow está listada explícitamente en `permissions.allow`  
**And** el formato de cada regla MCP es `mcp__<server>__<tool>` (sin wildcard al final)

---

## R3 — Context7 honesto

### R3a — Sin configuración

**Given** `.mcp.json` sin entrada `context7`  
**When** `Context7Delegate.detect()` corre  
**Then** devuelve `status: "UNAVAILABLE"`, `integration: "PLANNED"`  
**And** incluye `installHint` con instrucciones para añadir context7 a `.mcp.json`

### R3b — Configurado pero MCP no responde

**Given** `.mcp.json` con entrada `context7` (comando + args válidos)  
**And** el proceso MCP no responde al probe `initialize` en 3 segundos  
**When** `Context7Delegate.detect()` corre  
**Then** devuelve `status: "UNAVAILABLE"`, `integration: "READY"`  
**And** `reason` indica que el servidor no respondió  
**And** `installHint` incluye el comando para verificar manualmente

### R3c — Configurado y MCP responde

**Given** `.mcp.json` con entrada `context7`  
**And** el proceso MCP responde a `initialize` con `result` JSON-RPC válido  
**When** `Context7Delegate.detect()` corre  
**Then** devuelve `status: "AVAILABLE"`, `integration: "READY"`

### R3d — execute sin MCP disponible

**Given** `Context7Delegate.detect()` devuelve `UNAVAILABLE`  
**When** `Context7Delegate.execute({ operation: "documentation.fetch", ... })` corre  
**Then** devuelve `status: "UNAVAILABLE"`  
**And** `output` es `undefined` (no hay documentación fabricada)

### R3e — execute con operación no soportada

**Given** cualquier estado de Context7  
**When** `Context7Delegate.execute({ operation: "implement", ... })` corre  
**Then** devuelve `status: "UNSUPPORTED"` sin llamar al proceso MCP

---

## R4 — Delegación por capacidades

### R4a — resolveDelegate con operación soportada

**Given** delegation registry con al menos un delegate disponible que soporta la operación  
**When** `resolveDelegate("documentation.search", registry)` corre  
**Then** devuelve `{ blocked: false, delegate, delegateId }`  
**And** el delegate soporta la operación en su allowlist

### R4b — resolveDelegate con operación sin provider

**Given** delegation registry sin ningún delegate disponible que soporte la operación  
**When** `resolveDelegate("unsupported.op", registry)` corre  
**Then** devuelve `{ blocked: true, reason: string, installHint?: string }`  
**And** `reason` identifica la operación y propone acción

### R4c — orchestrateAgenticTask con operation bloqueada

**Given** operación para la que no hay delegate disponible  
**When** `orchestrateAgenticTask(prompt, phase, sddId, "unsupported.op")` corre  
**Then** devuelve `PlanResult` con `approved: false`  
**And** `blockers[0]` contiene `"delegation:BLOCKED"` y la causa accionable  
**And** no se invoca ningún runtime de provider

### R4d — orchestrateAgenticTask sin operation (backward compat)

**Given** llamada a `orchestrateAgenticTask(prompt, phase, sddId)` sin `operation`  
**When** corre  
**Then** comportamiento idéntico al anterior (pipeline Ruflo agentico)  
**And** no se invoca `createDelegationRegistry()`

### R4e — orchestrateAgenticTask con operation soportada por delegate no-ruflo

**Given** delegate disponible (ej. `ecc`) que soporta la operación  
**When** `orchestrateAgenticTask(prompt, "apply", sddId, "security")` corre  
**Then** usa el delegate `ecc` para ejecutar  
**And** devuelve `PlanResult` con resultado del delegate  
**And** `approved: true` solo si el delegate devuelve `COMPLETED`
