# Spec: Delegation Report Output

## R1 — Estructura del reporte

### R1a — Campos obligatorios presentes
- GIVEN `buildDelegationReport(params)`
- THEN resultado tiene: `taskId`, `prompt`, `timestamp`, `classification`, `delegationBlocked`, `devilsFindings`, `approved`, `blockers`

### R1b — Timestamp es ISO-8601
- GIVEN `buildDelegationReport(params)`
- THEN `timestamp` matchea `/^\d{4}-\d{2}-\d{2}T/`

---

## R2 — Delegación resuelta

### R2a — Delegación resuelta → resolvedDelegate presente
- GIVEN `resolution.blocked === false` con `delegateId: "ecc"`
- THEN `report.resolvedDelegate === "ecc"`
- AND `report.delegationBlocked === false`

### R2b — Delegación bloqueada → resolvedDelegate ausente
- GIVEN `resolution.blocked === true` con `reason: "no delegate supports op"`
- THEN `report.resolvedDelegate === undefined`
- AND `report.delegationBlocked === true`
- AND `report.delegationBlockedReason` contiene la razón

---

## R3 — Devil's Advocate findings

### R3a — level < 2 → no findings (devil no activo)
- GIVEN clasificación con `level === 0` o `1`
- THEN `devilsFindings` es array vacío

### R3b — touchesSecurityOrAuth → finding blocker
- GIVEN clasificación con `touchesSecurityOrAuth: true` y `level >= 2`
- THEN `devilsFindings` contiene entry con `severity: "blocker"` y `signal: "touchesSecurityOrAuth"`

### R3c — isIrreversible → finding blocker
- GIVEN clasificación con `isIrreversible: true` y `level >= 2`
- THEN `devilsFindings` contiene entry con `severity: "blocker"` y `signal: "isIrreversible"`

### R3d — touchesProduction → finding warning
- GIVEN clasificación con `touchesProduction: true` y `level >= 2`
- THEN `devilsFindings` contiene entry con `severity: "warning"` y `signal: "touchesProduction"`

### R3e — level 4 → finding info de complejidad
- GIVEN clasificación con `level === 4`
- THEN `devilsFindings` contiene entry con `signal: "level"` y `severity: "info"`

---

## R4 — Estado de aprobación

### R4a — Tarea aprobada: no bloqueada, ejecutada, viabilidad ready
- GIVEN delegación resuelta + ejecución COMPLETED + viabilidad "ready"
- THEN `approved === true`
- AND `blockers` es array vacío

### R4b — Delegación bloqueada → approved false
- GIVEN `resolution.blocked === true`
- THEN `approved === false`
- AND `blockers` contiene entry con "BLOCKED"

### R4c — Ejecución fallida → approved false
- GIVEN ejecución con `status: "FAILED"`
- THEN `approved === false`
- AND `blockers` contiene entry con "FAILED"

### R4d — Viabilidad needs_approval → blockers contiene NEEDS_APPROVAL
- GIVEN clasificación con `viability: "needs_approval"`
- AND delegación resuelta + ejecución COMPLETED
- THEN `blockers` contiene entry con "NEEDS_APPROVAL"

---

## R5 — Función pura

### R5a — Sin I/O
- GIVEN cualquier input válido
- WHEN `buildDelegationReport(params)`
- THEN no lanza excepciones, no hace I/O, resultado determinístico por input
