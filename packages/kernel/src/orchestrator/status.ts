import type { ProviderId, ProviderAvailability } from "../../../shared/src/ports/provider.js";

/**
 * Returns true for providers that are informational-only — either explicitly
 * disabled in providers.yaml or optional SDK/host-managed connectors that are
 * merely unconfigured. These MUST NOT appear in the "Acciones necesarias" list.
 *
 * Distinction:
 *   - disabled-in-config  → user set `enabled: false` deliberately.
 *   - optional-pending    → deepagents-style SDK provider with no entry
 *                           configured in the current environment.
 * Both are informational. A genuinely required-but-missing CLI provider
 * (e.g. its binary not found) is NOT optional and returns false here.
 */
export function isOptionalOrDisabled(
  providerId: ProviderId,
  s: Pick<ProviderAvailability, "available" | "status" | "kind">,
  providersConfig: Record<string, { enabled?: boolean }>
): boolean {
  // Explicitly disabled in providers.yaml (e.g. local: enabled: false)
  const def = providersConfig[providerId];
  if (def && def.enabled === false) return true;

  // Optional SDK/host-managed provider that is merely unconfigured — not truly
  // required under the current runtime. Covers deepagents running inside a
  // harness where HarnessAdapter is pending, and sdk-managed without keys.
  if (
    !s.available &&
    s.kind === "sdk" &&
    (s.status === "adapter-missing" || s.status === "missing")
  ) {
    return true;
  }

  return false;
}

/**
 * Returns a human-readable estado string for a provider status row.
 * Never returns READY unless `s.available === true` (strict-runtime rule).
 */
export function formatProviderStatus(
  s: Pick<ProviderAvailability, "available" | "status" | "kind">,
  providerId: ProviderId,
  providersConfig: Record<string, { enabled?: boolean }>
): string {
  // Disabled in providers.yaml
  const def = providersConfig[providerId];
  if (def && def.enabled === false) return "DISABLED (opcional)";

  if (s.available) {
    return s.status === "configured" ? "CONFIGURADO" : "READY";
  }

  // Optional sdk/host-managed pending states
  if (s.kind === "sdk" && s.status === "adapter-missing") return "HOST-MANAGED (PENDIENTE)";
  if (s.kind === "sdk" && s.status === "missing") return "OPCIONAL (no configurado)";

  if (s.kind === "catalog") return "CATÁLOGO AUSENTE";
  return s.status === "incompatible" ? "INCOMPATIBLE" : "MISSING";
}
