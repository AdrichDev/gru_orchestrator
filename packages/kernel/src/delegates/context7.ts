import type {
  ProviderDelegate,
  ProviderDetection,
  ProviderExecutionRequest,
  ProviderExecutionResult,
  ProviderCapability,
  DelegationProviderId,
} from "../../../shared/src/ports/delegation.js";
import { capabilitiesFor } from "./capabilities.js";
import { assertOperation, makeInvocationId } from "./base.js";

/**
 * Context7 delegate — documentation provider.
 *
 * Integration is PLANNED. The real MCP adapter is out of scope for this phase,
 * so Context7 stays UNAVAILABLE for the ENTIRE phase even when GRU_CONTEXT7_MCP
 * is set: the env var is detected as "config present" but never flips the
 * provider to AVAILABLE and never permits execute(). It never fabricates docs.
 */
export class Context7Delegate implements ProviderDelegate {
  readonly id: DelegationProviderId = "context7";

  async detect(): Promise<ProviderDetection> {
    const configured = Boolean(process.env.GRU_CONTEXT7_MCP);
    return {
      providerId: "context7",
      status: "UNAVAILABLE",
      integration: "PLANNED",
      kind: "mcp",
      reason: configured
        ? "GRU_CONTEXT7_MCP detected, but the Context7 MCP adapter is not implemented yet — provider remains UNAVAILABLE."
        : "Context7 MCP adapter not implemented/configured.",
      installHint: "Context7 integration is PLANNED; real MCP wiring is out of scope for this phase.",
    };
  }

  async getCapabilities(): Promise<ProviderCapability[]> {
    return capabilitiesFor("context7");
  }

  async execute(req: ProviderExecutionRequest): Promise<ProviderExecutionResult> {
    // Unknown operation → UNSUPPORTED (without touching any runtime).
    const guard = assertOperation("context7", req);
    if (guard) return guard;

    // Known operation, but integration is PLANNED → UNAVAILABLE, no fabricated docs.
    return {
      providerId: "context7",
      invocationId: makeInvocationId("context7"),
      status: "UNAVAILABLE",
      error: "Context7 MCP adapter not implemented — documentation retrieval is unavailable.",
      metadata: { integration: "PLANNED", operation: req.operation },
    };
  }
}
