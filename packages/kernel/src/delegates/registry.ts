import type {
  DelegationProviderId,
  DelegationProviderRegistry,
  DelegationRegistration,
} from "../../../shared/src/ports/delegation.js";

/**
 * In-memory delegation registry. Rejects duplicate registrations (no silent
 * overwrite) and exposes only AVAILABLE delegates via getAvailable() — no
 * silent fallback to a different provider.
 */
export class DefaultDelegationRegistry implements DelegationProviderRegistry {
  private readonly registrations = new Map<DelegationProviderId, DelegationRegistration>();

  register(registration: DelegationRegistration): void {
    if (this.registrations.has(registration.id)) {
      throw new Error(`Delegate already registered: ${registration.id}`);
    }
    this.registrations.set(registration.id, registration);
  }

  get(id: DelegationProviderId): DelegationRegistration | undefined {
    return this.registrations.get(id);
  }

  list(): DelegationRegistration[] {
    return [...this.registrations.values()];
  }

  async getAvailable(): Promise<DelegationRegistration[]> {
    const available: DelegationRegistration[] = [];
    for (const registration of this.registrations.values()) {
      const detection = await registration.delegate.detect();
      if (detection.status === "AVAILABLE") available.push(registration);
    }
    return available;
  }
}
