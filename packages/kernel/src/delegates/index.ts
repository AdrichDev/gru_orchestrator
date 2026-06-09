import { RufloProvider } from "@gru/provider-ruflo";
import { EccProvider } from "@gru/provider-ecc";
import { GentlePiProvider } from "@gru/provider-gentle-pi";
import { GentlemanCliProvider } from "@gru/provider-gentleman-cli";
import { DeepagentsProvider } from "@gru/provider-deepagents";
import { EngramProvider } from "@gru/provider-engram";
import { LocalProvider } from "@gru/provider-local";

import type { DelegationProviderId, ProviderDelegate } from "../../../shared/src/ports/delegation.js";
import { RufloProviderAdapter } from "../adapters/ruflo.js";
import { SimpleProviderDelegate, AgenticProviderDelegate } from "./base.js";
import { AwesomeCopilotDelegate } from "./awesome-copilot.js";
import { Context7Delegate } from "./context7.js";
import { DefaultDelegationRegistry } from "./registry.js";
import { flagsFor } from "./capabilities.js";

export * from "./base.js";
export * from "./capabilities.js";
export * from "./registry.js";
export * from "./resolver.js";
export { AwesomeCopilotDelegate } from "./awesome-copilot.js";
export { Context7Delegate } from "./context7.js";

/**
 * Builds the delegation registry over the EXISTING provider runtimes.
 * Ruflo uses the agentic façade (workflow lifecycle); the rest use the simple
 * façade. Context7 probes the real MCP server on detect().
 */
export function createDelegationRegistry(): DefaultDelegationRegistry {
  const registry = new DefaultDelegationRegistry();
  const add = (id: DelegationProviderId, delegate: ProviderDelegate) =>
    registry.register({ id, delegate, capabilities: flagsFor(id) });

  add("ruflo", new AgenticProviderDelegate("ruflo", new RufloProviderAdapter()));
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
