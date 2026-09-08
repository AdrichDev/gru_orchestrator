import { EccProvider } from "@gru/provider-ecc";
import { GentlePiProvider } from "@gru/provider-gentle-pi";
import { GentlemanCliProvider } from "@gru/provider-gentleman-cli";
import { DeepagentsProvider } from "@gru/provider-deepagents";
import { EngramProvider } from "@gru/provider-engram";
import { LocalProvider } from "@gru/provider-local";

import type { DelegationProviderId, ProviderDelegate } from "../../../shared/src/ports/delegation.js";
import { SimpleProviderDelegate } from "./base.js";
import { AwesomeCopilotDelegate } from "./awesome-copilot.js";
import { Context7Delegate } from "./context7.js";
import { DefaultDelegationRegistry } from "./registry.js";
import { flagsFor } from "./capabilities.js";
import { DelegationOrchestrator, createOrchestratorFromRegistry } from "./orchestrator.js";

export * from "./base.js";
export * from "./capabilities.js";
export * from "./registry.js";
export * from "./resolver.js";
export * from "./orchestrator.js";
export { AwesomeCopilotDelegate } from "./awesome-copilot.js";
export { Context7Delegate } from "./context7.js";

/**
 * Builds the delegation registry over the EXISTING provider runtimes.
 * They all use the simple façade. Context7 probes the real MCP server on
 * detect().
 */
export function createDelegationRegistry(): DefaultDelegationRegistry {
  const registry = new DefaultDelegationRegistry();
  const add = (id: DelegationProviderId, delegate: ProviderDelegate) =>
    registry.register({ id, delegate, capabilities: flagsFor(id) });

  add("ecc", new SimpleProviderDelegate("ecc", new EccProvider()));
  add("gentlePi", new SimpleProviderDelegate("gentlePi", new GentlePiProvider()));
  add("gentlemanCli", new SimpleProviderDelegate("gentlemanCli", new GentlemanCliProvider()));
  add("deepagents", new SimpleProviderDelegate("deepagents", new DeepagentsProvider()));
  add("engram", new SimpleProviderDelegate("engram", new EngramProvider()));
  add("awesomeCopilot", new AwesomeCopilotDelegate());
  add("context7", new Context7Delegate());
  add("local", new SimpleProviderDelegate("local", new LocalProvider()));

  return registry;
}

/**
 * Builds a `DelegationOrchestrator` pre-wired over the full provider registry.
 * Use this from the CLI or any entry point that needs direct-dispatch delegation.
 *
 * The returned orchestrator does NOT wire into the full risk-classification +
 * Devil's Advocate + human-approval pipeline from `orchestrateTask`. It is
 * intended for explicit, scripted invocations where the caller owns the risk
 * decision. See `DelegationOrchestrator` JSDoc for the documented gap.
 */
export function createDelegationOrchestrator(): DelegationOrchestrator {
  return createOrchestratorFromRegistry(createDelegationRegistry());
}
