export type ProviderId =
  | "local"
  | "ruflo"
  | "gentlePi"
  | "gentlemanCli"
  | "ecc"
  | "deepagents"
  | "engram"
  | "awesomeCopilot";

export type PersonaId = "caveman" | "devilsAdvocate";

export type ProviderStatus =
  | "missing"
  | "installed"
  | "configured"
  | "ready"
  | "degraded"
  | "incompatible"
  | "adapter-missing";

export type ProviderKind = "cli" | "catalog" | "sdk";

export interface ProviderTask {
  taskId: string;
  prompt: string;
  mode?: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderAvailability {
  providerId: ProviderId;
  available: boolean;
  status?: ProviderStatus;
  kind?: ProviderKind;
  executable?: string;
  version?: string;
  reason?: string;
  installHint?: string;
}

export interface ProviderResult {
  providerId: ProviderId;
  success: boolean;
  output: string;
  error?: string;
  exitCode?: number;
  executedCommand?: string;
}

export interface RoutingDecision {
  provider: ProviderId;
  personas: PersonaId[];
  confidence: number;
  reasons: string[];
  fallbacks: ProviderId[];
}

export interface GruProvider {
  id: ProviderId;
  canHandle(task: ProviderTask): boolean;
  checkAvailability(): Promise<ProviderAvailability>;
  run(task: ProviderTask): Promise<ProviderResult>;
}
