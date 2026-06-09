import type { ProviderDelegate, DelegationProviderId } from "../../../shared/src/ports/delegation.js";
import type { DefaultDelegationRegistry } from "./registry.js";

export interface DelegationResolved {
  blocked: false;
  delegate: ProviderDelegate;
  delegateId: DelegationProviderId;
}

export interface DelegationBlocked {
  blocked: true;
  reason: string;
  installHint?: string;
}

/**
 * Finds the first available delegate that supports the given operation.
 * Returns BLOCKED (with actionable reason) when no delegate can handle it.
 * Never silently falls back to a different operation or provider.
 */
export async function resolveDelegate(
  operation: string,
  registry: DefaultDelegationRegistry,
): Promise<DelegationResolved | DelegationBlocked> {
  const available = await registry.getAvailable();

  for (const registration of available) {
    const caps = await registration.delegate.getCapabilities();
    const supported = caps.some((c) => c.operations.includes(operation));
    if (supported) {
      return { blocked: false, delegate: registration.delegate, delegateId: registration.id };
    }
  }

  return {
    blocked: true,
    reason: `No available provider supports operation '${operation}'.`,
    installHint: "Check that required MCP servers and CLIs are installed and running.",
  };
}
