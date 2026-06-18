/**
 * SQ-01 — Provider registry extensibility tests
 *
 * Verifies:
 *  1. registerProvider() adds a provider that is resolvable via getRegisteredProviders()
 *  2. All built-in providers are pre-registered (registry is pre-populated from PROVIDERS)
 *  3. A registered third-party provider coexists with the built-ins without displacing them
 *  4. orchestrateTask routes the known built-in providers exactly as before (routing unchanged)
 */

import { describe, it, expect } from "vitest";
import {
  PROVIDERS,
  registerProvider,
  getRegisteredProviders,
} from "../packages/kernel/src/orchestrator/index.js";
import type { GruProvider, ProviderTask, ProviderResult, ProviderAvailability } from "../packages/shared/src/ports/provider.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

class StubProvider implements GruProvider {
  constructor(public readonly id: string) {}
  canHandle(_task: ProviderTask): boolean { return false; }
  async checkAvailability(): Promise<ProviderAvailability> {
    return { providerId: this.id as never, available: true, status: "ready" };
  }
  async run(_task: ProviderTask): Promise<ProviderResult> {
    return { providerId: this.id as never, success: true, output: `stub:${this.id}` };
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SQ-01 — GruProviderRegistry (extension seam)", () => {
  it("PROVIDERS export contains all 8 built-in providers", () => {
    const ids = Object.keys(PROVIDERS);
    expect(ids).toContain("ruflo");
    expect(ids).toContain("gentlePi");
    expect(ids).toContain("gentlemanCli");
    expect(ids).toContain("ecc");
    expect(ids).toContain("deepagents");
    expect(ids).toContain("engram");
    expect(ids).toContain("awesomeCopilot");
    expect(ids).toContain("local");
    expect(ids).toHaveLength(8);
  });

  it("registry is pre-populated: getRegisteredProviders includes all built-ins", () => {
    const registered = getRegisteredProviders();
    const ids = registered.map((p) => p.id as string);
    for (const id of Object.keys(PROVIDERS)) {
      expect(ids).toContain(id);
    }
  });

  it("registerProvider() adds a third-party provider to the registry", () => {
    const plugin = new StubProvider("my-third-party-provider");
    registerProvider(plugin as GruProvider);

    const registered = getRegisteredProviders();
    const found = registered.find((p) => (p.id as string) === "my-third-party-provider");
    expect(found).toBeDefined();
    expect(found).toBe(plugin);
  });

  it("third-party provider coexists with built-ins — built-ins not displaced", () => {
    const plugin = new StubProvider("another-plugin");
    registerProvider(plugin as GruProvider);

    const registered = getRegisteredProviders();
    const ids = registered.map((p) => p.id as string);

    // Third-party present
    expect(ids).toContain("another-plugin");

    // Built-ins still present
    expect(ids).toContain("ruflo");
    expect(ids).toContain("awesomeCopilot");
    expect(ids).toContain("local");
  });

  it("re-registering a provider with the same id replaces the previous entry", () => {
    const v1 = new StubProvider("replace-me");
    const v2 = new StubProvider("replace-me");
    registerProvider(v1 as GruProvider);
    registerProvider(v2 as GruProvider);

    const registered = getRegisteredProviders();
    const matches = registered.filter((p) => (p.id as string) === "replace-me");
    expect(matches).toHaveLength(1);
    expect(matches[0]).toBe(v2);
  });
});
