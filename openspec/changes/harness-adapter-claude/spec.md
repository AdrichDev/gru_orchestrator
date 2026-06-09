# Spec: Claude Harness Adapter

## R1 — Disponibilidad

### R1a — Harness activo es claude → ready
- GIVEN `detectHarness()` devuelve `"claude"`
- WHEN `checkAvailability()` ejecuta
- THEN `status === "ready"`

### R1b — Harness activo no es claude → unsupported
- GIVEN `detectHarness()` devuelve `"standalone"` o cualquier otro harness
- WHEN `checkAvailability()` ejecuta
- THEN `status === "unsupported"`
- AND `reason` menciona el harness detectado

---

## R2 — Capabilities estáticas

### R2a — file-tools siempre soportado
- GIVEN `ClaudeHarnessAdapter`
- WHEN `supports("file-tools")`
- THEN `true`

### R2b — native-subagents siempre soportado
- GIVEN `ClaudeHarnessAdapter`
- WHEN `supports("native-subagents")`
- THEN `true`

### R2c — code-execution siempre soportado
- GIVEN `ClaudeHarnessAdapter`
- WHEN `supports("code-execution")`
- THEN `true`

### R2d — web-search siempre soportado
- GIVEN `ClaudeHarnessAdapter`
- WHEN `supports("web-search")`
- THEN `true`

### R2e — memory NO soportado (no detectado en esta fase)
- GIVEN `ClaudeHarnessAdapter`
- WHEN `supports("memory")`
- THEN `false`

### R2f — approval-flow NO soportado (no wired en esta fase)
- GIVEN `ClaudeHarnessAdapter`
- WHEN `supports("approval-flow")`
- THEN `false`

---

## R3 — Contexto

### R3a — getContext devuelve harness "claude" y modelControl "host-managed"
- GIVEN harness detectado es claude
- WHEN `getContext()`
- THEN `harness === "claude"`
- AND `modelControl === "host-managed"`
- AND `capabilities` incluye todos los valores de R2a-R2d

---

## R4 — Ejecución host-managed

### R4a — execute cuando disponible → success, runtimeMode host-managed
- GIVEN harness activo es claude
- WHEN `execute(task)`
- THEN `success === true`
- AND `execution.runtimeMode === "host-managed"`
- AND `execution.adapter === "claude"`

### R4b — execute cuando no disponible → success false, error HARNESS_UNAVAILABLE
- GIVEN harness NO es claude
- WHEN `execute(task)`
- THEN `success === false`
- AND `error.code === "HARNESS_UNAVAILABLE"`
- AND `error.recoverable === false`

---

## R5 — Identidad

### R5a — id fijo "claude"
- GIVEN `ClaudeHarnessAdapter`
- THEN `id === "claude"`

### R5b — Implementa HarnessAdapter interface
- GIVEN `new ClaudeHarnessAdapter()`
- THEN TypeScript compila sin error de tipo asignable a `HarnessAdapter`
