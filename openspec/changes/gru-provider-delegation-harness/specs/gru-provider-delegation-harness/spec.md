# Spec — Gru Provider Delegation Harness

## S1 — Detección de disponibilidad
- **Given** un `ProviderDelegate` registrado
- **When** se llama `detect()`
- **Then** devuelve `status ∈ {AVAILABLE, UNAVAILABLE, UNSUPPORTED}` e
  `integration ∈ {READY, PLANNED, DISABLED}`, sin rutas absolutas en `executable`.

## S2 — Capacidades reales
- **Given** un delegate
- **When** se llama `getCapabilities()`
- **Then** devuelve solo capacidades derivadas del mecanismo real del provider
  (no capacidades falsas), cada una con su allowlist de operaciones y flag
  `synchronous`.

## S3 — Validación de operaciones
- **Given** un delegate con una allowlist
- **When** `execute()` recibe una operación **no** soportada
- **Then** devuelve `status: UNSUPPORTED` **sin** invocar el runtime subyacente
  (`run()`/`execute()` no se llaman).

## S4 — Delegación síncrona honesta
- **Given** un provider síncrono disponible (p. ej. `ecc consult`)
- **When** `execute()` recibe una operación soportada
- **Then** invoca el `.run()` existente y mapea `success→COMPLETED`,
  `!success→FAILED`. Si el provider no está disponible → `UNAVAILABLE` sin invocar
  `run()`.

## S5 — Delegación asíncrona (Ruflo) sin falsos positivos
- **Given** Ruflo, cuyo `workflow run` es asíncrono
- **When** `execute()` delega y el workflow queda en `submitted`/`running`/sin progreso
- **Then** el estado es `SUBMITTED`/`RUNNING`/`UNSUPPORTED` respectivamente, **nunca
  `COMPLETED`**; `TIMEOUT` no se transforma en `FAILED`; se preserva
  `externalExecutionId` (workflowId).

## S6 — Context7 PLANNED
- **Given** Context7 sin adapter MCP real
- **When** `detect()` se llama (con o sin `GRU_CONTEXT7_MCP`)
- **Then** devuelve `UNAVAILABLE` + `PLANNED`; `execute()` de una operación prevista
  devuelve `UNAVAILABLE` sin documentación inventada.

## S7 — Registry sin fallback silencioso
- **Given** un `DelegationProviderRegistry` con delegates disponibles y no disponibles
- **When** se llama `getAvailable()`
- **Then** devuelve solo los `AVAILABLE` (Context7/Engram no disponibles quedan
  excluidos); `register()` rechaza duplicados; no hay sustitución silenciosa.

## S8 — Referencias portables
- **Given** un resultado de ejecución persistible
- **When** se generan `artifacts`/`evidenceRefs`
- **Then** son relativos o lógicos; ninguna ruta absoluta (`D:\…`, `/…`) aparece
  como referencia canónica.
