import { AwesomeCopilotProvider } from "@gru/provider-awesome-copilot";
import type {
  ProviderExecutionRequest,
  ProviderExecutionResult,
  ProviderIntegrationStatus,
} from "../../../shared/src/ports/delegation.js";
import { SimpleProviderDelegate, assertOperation, wrapSyncRun } from "./base.js";

/**
 * Awesome Copilot delegate: real catalog read for skill discovery.
 * Emits portable logical refs (`awesome-copilot:<relative/path>`) — never
 * absolute machine paths. A SKILL.md is a resource, not an executable agent,
 * so only skill/catalog operations are allowed (enforced by the allowlist).
 */
export class AwesomeCopilotDelegate extends SimpleProviderDelegate {
  constructor(provider: AwesomeCopilotProvider = new AwesomeCopilotProvider(), integration: ProviderIntegrationStatus = "READY") {
    super("awesomeCopilot", provider, integration);
  }

  async execute(req: ProviderExecutionRequest): Promise<ProviderExecutionResult> {
    const guard = assertOperation("awesomeCopilot", req);
    if (guard) return guard;

    const base = await wrapSyncRun("awesomeCopilot", this.provider, req);
    if (base.status !== "COMPLETED") return base;

    // AwesomeCopilotProvider.run() outputs lines: "- <relative/path> (score N)".
    const refs = (base.output ?? "")
      .split("\n")
      .map((line) => line.match(/^- (.+?) \(score/)?.[1])
      .filter((ref): ref is string => Boolean(ref))
      .map((rel) => `awesome-copilot:${rel.replace(/\\/g, "/")}`);

    return { ...base, artifacts: refs, evidenceRefs: refs };
  }
}
