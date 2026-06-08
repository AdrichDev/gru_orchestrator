import type { ProviderId } from "./provider.js";

export type SddPhase =
  | "explore"
  | "proposal"
  | "spec"
  | "design"
  | "tasks"
  | "apply"
  | "verify"
  | "sync"
  | "archive";

export type AgentExecutionMode = "write" | "review" | "test" | "plan" | "research";

export type AgentAvailability = "available" | "unavailable" | "unsupported";

export interface AgentDescriptor {
  id: string;
  provider: ProviderId;
  sourcePath: string;
  name: string;
  description: string;
  capabilities: string[];
  supportedPhases: SddPhase[];
  tools: string[];
  skills: string[];
  executionMode: AgentExecutionMode;
  riskLevel: 0 | 1 | 2 | 3 | 4;
  canWrite: boolean;
  canReview: boolean;
  canTest: boolean;
  availability: AgentAvailability;
  metadata?: Record<string, unknown>;
}

export interface CapabilityDescriptor {
  id: string;
  domain: string;
  sddPhase: SddPhase;
  riskLevel: 0 | 1 | 2 | 3 | 4;
  requirements: string[];
}

/** Lazy-indexed catalog. Never loads all agent bodies into context at once. */
export interface AgentCatalog {
  readonly provider: ProviderId;
  listAgents(): Promise<AgentDescriptor[]>;
  getAgent(id: string): Promise<AgentDescriptor | undefined>;
  findByPhase(phase: SddPhase): Promise<AgentDescriptor[]>;
  findByCapability(capability: string): Promise<AgentDescriptor[]>;
  findByMode(mode: AgentExecutionMode): Promise<AgentDescriptor[]>;
}
