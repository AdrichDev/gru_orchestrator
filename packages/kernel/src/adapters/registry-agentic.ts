import type {
  ProviderAdapter,
  ProviderRegistry,
} from "../../../shared/src/ports/orchestration.js";
import type { ProviderId } from "../../../shared/src/ports/provider.js";

export class DefaultProviderRegistry implements ProviderRegistry {
  private readonly adapters: Map<ProviderId, ProviderAdapter> = new Map();

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: ProviderId): ProviderAdapter | undefined {
    return this.adapters.get(id);
  }

  list(): ProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  async getAvailable(): Promise<ProviderAdapter[]> {
    const checks = await Promise.allSettled(
      Array.from(this.adapters.values()).map(async (adapter) => {
        const status = await adapter.checkAvailability();
        return { adapter, available: status.status === "available" };
      })
    );
    return checks
      .filter(
        (r): r is PromiseFulfilledResult<{ adapter: ProviderAdapter; available: boolean }> =>
          r.status === "fulfilled" && r.value.available
      )
      .map((r) => r.value.adapter);
  }
}
