import { describe, it, expect } from "vitest";
import { isOptionalOrDisabled, formatProviderStatus } from "../status.js";
import type { ProviderId } from "../../../../shared/src/ports/provider.js";

// ─── isOptionalOrDisabled ─────────────────────────────────────────────────────

describe("isOptionalOrDisabled", () => {
  it("returns true for local when enabled: false in providers.yaml", () => {
    const providersConfig = { local: { enabled: false } };
    const s = { available: false, status: "missing" as const, kind: "local-runtime" };
    expect(isOptionalOrDisabled("local" as ProviderId, s, providersConfig)).toBe(true);
  });

  it("returns false for local when enabled: true in providers.yaml", () => {
    const providersConfig = { local: { enabled: true } };
    const s = { available: false, status: "missing" as const, kind: "local-runtime" };
    expect(isOptionalOrDisabled("local" as ProviderId, s, providersConfig)).toBe(false);
  });

  it("returns true for deepagents when status=adapter-missing and kind=sdk (host-managed, no entry)", () => {
    const providersConfig = { deepagents: { enabled: true } };
    const s = { available: false, status: "adapter-missing" as const, kind: "sdk" };
    expect(isOptionalOrDisabled("deepagents" as ProviderId, s, providersConfig)).toBe(true);
  });

  it("returns true for deepagents when status=missing and kind=sdk (sdk-managed, no keys)", () => {
    const providersConfig = { deepagents: { enabled: true } };
    const s = { available: false, status: "missing" as const, kind: "sdk" };
    expect(isOptionalOrDisabled("deepagents" as ProviderId, s, providersConfig)).toBe(true);
  });

  it("returns false for ruflo when status=missing and kind=cli (genuinely required)", () => {
    const providersConfig = { ruflo: { enabled: true } };
    const s = { available: false, status: "missing" as const, kind: "cli" };
    expect(isOptionalOrDisabled("ruflo" as ProviderId, s, providersConfig)).toBe(false);
  });

  it("returns false for engram when status=missing and kind=memory-runtime (genuinely required)", () => {
    const providersConfig = { engram: { enabled: true } };
    const s = { available: false, status: "missing" as const, kind: "memory-runtime" };
    expect(isOptionalOrDisabled("engram" as ProviderId, s, providersConfig)).toBe(false);
  });

  it("returns false for awesomeCopilot when kind=catalog (genuinely required-but-missing catalog)", () => {
    const providersConfig = { awesomeCopilot: { enabled: true } };
    const s = { available: false, status: "missing" as const, kind: "catalog" };
    expect(isOptionalOrDisabled("awesomeCopilot" as ProviderId, s, providersConfig)).toBe(false);
  });

  it("returns false for available providers regardless of config", () => {
    const providersConfig = { ruflo: { enabled: true } };
    const s = { available: true, status: "ready" as const, kind: "cli" };
    expect(isOptionalOrDisabled("ruflo" as ProviderId, s, providersConfig)).toBe(false);
  });

  it("returns true when provider entry is absent from config but kind=sdk status=adapter-missing", () => {
    // No entry in providers.yaml for the provider
    const providersConfig: Record<string, { enabled?: boolean }> = {};
    const s = { available: false, status: "adapter-missing" as const, kind: "sdk" };
    expect(isOptionalOrDisabled("deepagents" as ProviderId, s, providersConfig)).toBe(true);
  });
});

// ─── formatProviderStatus ─────────────────────────────────────────────────────

describe("formatProviderStatus", () => {
  it("returns 'DISABLED (opcional)' for local with enabled: false", () => {
    const providersConfig = { local: { enabled: false } };
    const s = { available: false, status: "missing" as const, kind: "local-runtime" };
    expect(formatProviderStatus(s, "local" as ProviderId, providersConfig)).toBe("DISABLED (opcional)");
  });

  it("returns 'READY' for an available provider", () => {
    const providersConfig = { ruflo: { enabled: true } };
    const s = { available: true, status: "ready" as const, kind: "cli" };
    expect(formatProviderStatus(s, "ruflo" as ProviderId, providersConfig)).toBe("READY");
  });

  it("returns 'CONFIGURADO' for a provider with status=configured", () => {
    const providersConfig = { engram: { enabled: true } };
    const s = { available: true, status: "configured" as const, kind: "memory-runtime" };
    expect(formatProviderStatus(s, "engram" as ProviderId, providersConfig)).toBe("CONFIGURADO");
  });

  it("returns 'HOST-MANAGED (PENDIENTE)' for deepagents adapter-missing", () => {
    const providersConfig = { deepagents: { enabled: true } };
    const s = { available: false, status: "adapter-missing" as const, kind: "sdk" };
    expect(formatProviderStatus(s, "deepagents" as ProviderId, providersConfig)).toBe("HOST-MANAGED (PENDIENTE)");
  });

  it("returns 'OPCIONAL (no configurado)' for deepagents sdk missing", () => {
    const providersConfig = { deepagents: { enabled: true } };
    const s = { available: false, status: "missing" as const, kind: "sdk" };
    expect(formatProviderStatus(s, "deepagents" as ProviderId, providersConfig)).toBe("OPCIONAL (no configurado)");
  });

  it("returns 'CATÁLOGO AUSENTE' for awesomeCopilot with kind=catalog when missing", () => {
    const providersConfig = { awesomeCopilot: { enabled: true } };
    const s = { available: false, status: "missing" as const, kind: "catalog" };
    expect(formatProviderStatus(s, "awesomeCopilot" as ProviderId, providersConfig)).toBe("CATÁLOGO AUSENTE");
  });

  it("returns 'MISSING' for a required CLI provider that is not installed", () => {
    const providersConfig = { ruflo: { enabled: true } };
    const s = { available: false, status: "missing" as const, kind: "cli" };
    expect(formatProviderStatus(s, "ruflo" as ProviderId, providersConfig)).toBe("MISSING");
  });

  it("returns 'INCOMPATIBLE' for a provider with status=incompatible", () => {
    const providersConfig = { gentlePi: { enabled: true } };
    const s = { available: false, status: "incompatible" as const, kind: "cli" };
    expect(formatProviderStatus(s, "gentlePi" as ProviderId, providersConfig)).toBe("INCOMPATIBLE");
  });

  it("NEVER returns READY for an unavailable provider (strict-runtime rule)", () => {
    const providersConfig = { ruflo: { enabled: true } };
    const s = { available: false, status: "ready" as const, kind: "cli" };
    // Even if status says 'ready', if available=false it must NOT return READY
    const result = formatProviderStatus(s, "ruflo" as ProviderId, providersConfig);
    expect(result).not.toBe("READY");
  });
});

// ─── Actions list filtering (integration-style) ───────────────────────────────

describe("Actions list filtering — disabled/optional excluded, required included", () => {
  type StatusEntry = {
    providerId: ProviderId;
    available: boolean;
    status?: string;
    kind?: string;
  };

  function buildActionsRequired(
    statuses: StatusEntry[],
    providersConfig: Record<string, { enabled?: boolean }>
  ): StatusEntry[] {
    return statuses.filter(
      (s) => !s.available && !isOptionalOrDisabled(s.providerId, s, providersConfig)
    );
  }

  it("excludes local (disabled) and deepagents (sdk pending) from actions list", () => {
    const statuses: StatusEntry[] = [
      { providerId: "local" as ProviderId, available: false, status: "missing", kind: "local-runtime" },
      { providerId: "deepagents" as ProviderId, available: false, status: "adapter-missing", kind: "sdk" },
      { providerId: "ruflo" as ProviderId, available: true, status: "ready", kind: "cli" },
      { providerId: "engram" as ProviderId, available: true, status: "ready", kind: "memory-runtime" },
    ];
    const providersConfig = {
      local: { enabled: false },
      deepagents: { enabled: true },
      ruflo: { enabled: true },
      engram: { enabled: true },
    };

    const actions = buildActionsRequired(statuses, providersConfig);
    expect(actions).toHaveLength(0);
    expect(actions.map((s) => s.providerId)).not.toContain("local");
    expect(actions.map((s) => s.providerId)).not.toContain("deepagents");
  });

  it("includes a genuinely required-but-missing provider in actions list", () => {
    const statuses: StatusEntry[] = [
      { providerId: "local" as ProviderId, available: false, status: "missing", kind: "local-runtime" },
      { providerId: "deepagents" as ProviderId, available: false, status: "adapter-missing", kind: "sdk" },
      { providerId: "ruflo" as ProviderId, available: false, status: "missing", kind: "cli" }, // required, missing!
    ];
    const providersConfig = {
      local: { enabled: false },
      deepagents: { enabled: true },
      ruflo: { enabled: true },
    };

    const actions = buildActionsRequired(statuses, providersConfig);
    expect(actions).toHaveLength(1);
    expect(actions[0].providerId).toBe("ruflo");
  });

  it("empty actions list when all providers are either available, disabled, or optional", () => {
    const statuses: StatusEntry[] = [
      { providerId: "ruflo" as ProviderId, available: true },
      { providerId: "gentlePi" as ProviderId, available: true },
      { providerId: "gentlemanCli" as ProviderId, available: true },
      { providerId: "ecc" as ProviderId, available: true },
      { providerId: "engram" as ProviderId, available: true },
      { providerId: "awesomeCopilot" as ProviderId, available: true },
      { providerId: "local" as ProviderId, available: false, kind: "local-runtime" },
      { providerId: "deepagents" as ProviderId, available: false, status: "adapter-missing", kind: "sdk" },
    ];
    const providersConfig = {
      local: { enabled: false },
      deepagents: { enabled: true },
    };

    const actions = buildActionsRequired(statuses, providersConfig);
    expect(actions).toHaveLength(0);
  });
});
