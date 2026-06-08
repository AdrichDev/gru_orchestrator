import type {
  DelegationProviderId,
  ProviderCapability,
  ProviderCapabilityFlags,
  ProviderCapabilityName,
} from "../../../shared/src/ports/delegation.js";

/**
 * Single source of truth for what each provider really supports.
 * Derived from the providers' actual execution mechanisms — no fake capabilities.
 * Operation allowlists are enforced before any runtime call.
 *
 * `synchronous: false` means the provider only submits work (SUBMITTED/RUNNING);
 * it does not return a terminal result inline.
 */
const SPECS: Record<DelegationProviderId, ProviderCapability[]> = {
  // Ruflo: async workflow submission (needs MCP + Claude Code to reach COMPLETED).
  ruflo: [
    { name: "planning", operations: ["plan"], synchronous: false },
    { name: "implementation", operations: ["implement"], synchronous: false },
    { name: "review", operations: ["review"], synchronous: false },
    { name: "testing", operations: ["test"], synchronous: false },
    { name: "security", operations: ["security"], synchronous: false },
    { name: "multiAgent", operations: ["swarm"], synchronous: false },
  ],
  // ECC: synchronous advisory `ecc consult <prompt>`.
  ecc: [
    { name: "review", operations: ["consult", "review"], synchronous: true },
    { name: "security", operations: ["security"], synchronous: true },
  ],
  // Gentle Pi: synchronous `pi -p <prompt>` (CLI typically absent → UNAVAILABLE).
  gentlePi: [
    { name: "sdd", operations: ["sdd"], synchronous: true },
    { name: "planning", operations: ["plan"], synchronous: true },
    { name: "review", operations: ["review"], synchronous: true },
    { name: "testing", operations: ["test"], synchronous: true },
  ],
  // Gentleman CLI: synchronous `gentle-ai consult` (CLI typically absent → UNAVAILABLE).
  gentlemanCli: [
    { name: "sdd", operations: ["sdd"], synchronous: true },
    { name: "planning", operations: ["plan"], synchronous: true },
  ],
  // DeepAgents: SDK invoke (needs API key/harness → UNAVAILABLE without setup).
  deepagents: [
    { name: "planning", operations: ["plan"], synchronous: true },
    { name: "implementation", operations: ["implement"], synchronous: true },
    { name: "multiAgent", operations: ["subagents"], synchronous: true },
  ],
  // Awesome Copilot: real catalog read — skill discovery only.
  awesomeCopilot: [
    {
      name: "skillDiscovery",
      operations: ["skill.discover", "skill.search", "skill.read", "catalog.search"],
      synchronous: true,
    },
  ],
  // Engram: memory ops (CLI typically absent → UNAVAILABLE).
  engram: [
    {
      name: "memory",
      operations: ["memory.search", "memory.retrieve", "memory.store"],
      synchronous: true,
    },
  ],
  // Context7: PLANNED. Operations are PLANNED, not real. Always UNAVAILABLE this phase.
  context7: [
    {
      name: "documentation",
      operations: ["documentation.search", "documentation.resolve", "documentation.fetch"],
      synchronous: true,
    },
  ],
  // Local: no real deterministic operation is registered yet.
  local: [],
};

export function capabilitiesFor(id: DelegationProviderId): ProviderCapability[] {
  return (SPECS[id] ?? []).map((c) => ({ ...c, operations: [...c.operations] }));
}

export function allowlistFor(id: DelegationProviderId): string[] {
  return (SPECS[id] ?? []).flatMap((c) => c.operations);
}

export function flagsFor(id: DelegationProviderId): ProviderCapabilityFlags {
  const names = new Set<ProviderCapabilityName>((SPECS[id] ?? []).map((c) => c.name));
  return {
    planning: names.has("planning"),
    sdd: names.has("sdd"),
    implementation: names.has("implementation"),
    review: names.has("review"),
    testing: names.has("testing"),
    security: names.has("security"),
    memory: names.has("memory"),
    documentation: names.has("documentation"),
    skillDiscovery: names.has("skillDiscovery"),
    multiAgent: names.has("multiAgent"),
  };
}
