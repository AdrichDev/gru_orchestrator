import type {
  GruCapability,
  GruResult,
  GruTask,
  HarnessAdapter,
  HarnessAvailability,
  HarnessContext,
  HarnessId,
} from "../../../shared/src/ports/harness.js";
import { detectHarness } from "../../../shared/src/runtime/harness.js";
import { ClaudeHarnessAdapter } from "./harness-claude.js";

/**
 * StubHarnessAdapter — placeholder for harnesses whose real adapter is not yet
 * implemented (codex, gemini, pi) and for the standalone runtime (which is
 * served by the provider's own SDK path, not by a host adapter).
 *
 * Conservative by design (see SDD S7 Devil Check): never claims a capability it
 * does not implement and never reports `ready`. Any host-managed consumer that
 * resolves a stub therefore stays in `adapter-missing` instead of silently
 * pretending the harness can execute.
 */
export class StubHarnessAdapter implements HarnessAdapter {
  constructor(readonly id: HarnessId) {}

  async checkAvailability(): Promise<HarnessAvailability> {
    return {
      status: "unsupported",
      reason: `HarnessAdapter for '${this.id}' is not implemented yet.`,
    };
  }

  supports(_capability: GruCapability): boolean {
    return false;
  }

  async getContext(): Promise<HarnessContext> {
    return {
      harness: this.id,
      modelControl: "unknown",
      capabilities: [],
    };
  }

  async execute(_task: GruTask): Promise<GruResult> {
    return {
      success: false,
      output: "",
      harness: this.id,
      execution: { adapter: this.id, runtimeMode: "host-managed" },
      error: {
        code: "CAPABILITY_UNSUPPORTED",
        message: `HarnessAdapter for '${this.id}' is not implemented yet.`,
        recoverable: false,
      },
    };
  }
}

/**
 * Resolve the HarnessAdapter for a given harness id.
 *
 * Implemented adapters return their real instance; everything else returns a
 * StubHarnessAdapter so callers can rely on the contract (checkAvailability /
 * supports / execute) without null checks. Standalone is intentionally a stub:
 * SDK-managed execution lives in the provider, not in a host adapter.
 */
export function resolveHarnessAdapter(harnessId: HarnessId): HarnessAdapter {
  switch (harnessId) {
    case "claude":
      return new ClaudeHarnessAdapter();
    case "codex":
    case "gemini":
    case "pi":
    case "standalone":
    default:
      return new StubHarnessAdapter(harnessId);
  }
}

/**
 * Resolve the HarnessAdapter for the currently active harness.
 * `detect` is injectable for tests; defaults to env-based detectHarness().
 */
export function getActiveHarnessAdapter(
  detect: () => HarnessId = detectHarness,
): HarnessAdapter {
  return resolveHarnessAdapter(detect());
}
