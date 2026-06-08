import type { HarnessAdapter } from "../../../shared/src/ports/harness.js";
import type { HarnessId } from "../../../shared/src/runtime/harness.js";
import { detectHarness } from "../../../shared/src/runtime/harness.js";

export class AdapterRegistry {
  private static readonly adapters: Map<HarnessId, HarnessAdapter> = new Map();

  static register(adapter: HarnessAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  static get(id: HarnessId): HarnessAdapter | undefined {
    return this.adapters.get(id);
  }

  /** Returns the adapter for the currently detected harness, if registered. */
  static getActive(): HarnessAdapter | undefined {
    return this.adapters.get(detectHarness());
  }

  static list(): HarnessAdapter[] {
    return Array.from(this.adapters.values());
  }

  static has(id: HarnessId): boolean {
    return this.adapters.has(id);
  }
}
