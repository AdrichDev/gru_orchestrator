# Spec: Strict Harness Controller

## R1 — Harness no disponible

### R1a — Harness unavailable → always blocked
- GIVEN harness `checkAvailability()` devuelve `status: "unsupported"` o `"missing"`
- WHEN `gate(prompt, signals, opts)` ejecuta
- THEN `allowed === false`
- AND `blockers` contiene entry con "BLOCKED"

---

## R2 — Tarea trivial (viability ready)

### R2a — Trivial, harness ready → allowed
- GIVEN harness ready, tarea trivial sin signals de riesgo
- WHEN `gate("add comment")`
- THEN `allowed === true`
- AND `blockers` vacío

---

## R3 — Viability needs_approval

### R3a — needs_approval sin forceApproval → blocked
- GIVEN harness ready, task con `touchesProduction: true`
- WHEN `gate(prompt, signals)` sin `forceApproval`
- THEN `allowed === false`
- AND `blockers` contiene "NEEDS_APPROVAL"

### R3b — needs_approval con forceApproval=true → allowed
- GIVEN harness ready, task con `touchesProduction: true`
- WHEN `gate(prompt, signals, { forceApproval: true })`
- THEN `allowed === true`
- AND `blockers` vacío

---

## R4 — Capability check

### R4a — Nivel >= 3, harness sin native-subagents → blocked
- GIVEN harness ready pero `supports("native-subagents") === false`
- AND task clasifica nivel >= 3
- WHEN `gate(prompt, signals)`
- THEN `allowed === false`
- AND `classification.viability === "blocked"`
- AND `classification.signals.missingCapability === "native-subagents"`

### R4b — Nivel >= 3, harness con native-subagents → allowed (si viability ready)
- GIVEN harness ready y `supports("native-subagents") === true`
- AND task clasifica nivel 3 sin signals de riesgo crítico
- WHEN `gate(prompt, signals)`
- THEN `allowed === true`

### R4c — Nivel < 3, harness sin native-subagents → no afecta
- GIVEN harness ready pero sin native-subagents
- AND task clasifica nivel <= 2
- WHEN `gate(prompt, signals)`
- THEN nivel bajo no requiere native-subagents → allowed si viability ready

---

## R5 — Classification en result

### R5a — GateResult incluye classification completa
- GIVEN cualquier gate call
- THEN `result.classification` es `TaskClassification` completa con level, viability, suggestedMinions

---

## R6 — Función sin I/O extra

### R6a — No lanza excepciones para inputs válidos
- GIVEN cualquier combinación de prompt + signals + opts
- WHEN `gate()` ejecuta
- THEN no lanza; devuelve GateResult siempre
