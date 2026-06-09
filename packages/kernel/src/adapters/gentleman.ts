import { execa as defaultExeca } from "execa";
import type {
  AgentCatalog,
  AgentDescriptor,
  SddPhase,
  AgentExecutionMode,
} from "../../../shared/src/ports/agent.js";
import type {
  ProviderAdapter,
  ProviderAdapterStatus,
  TaskAssignment,
} from "../../../shared/src/ports/orchestration.js";
import type { ExecutionResult } from "../../../shared/src/ports/results.js";
import type { ProviderId } from "../../../shared/src/ports/provider.js";

const SDD_PHASES: SddPhase[] = [
  "explore", "proposal", "spec", "design", "tasks",
  "apply", "verify", "sync", "archive",
];

function makePhaseAgent(phase: SddPhase): AgentDescriptor {
  return {
    id: `gentlemanCli:${phase}`,
    provider: "gentlemanCli" as ProviderId,
    sourcePath: ".gentleman/phases",
    name: `Gentleman SDD — ${phase}`,
    description: `Validates and advances SDD phase: ${phase}. Never writes product code.`,
    capabilities: ["sdd-workflow", `sdd-${phase}`],
    supportedPhases: [phase],
    tools: ["gentle-ai"],
    skills: [],
    executionMode: "plan" as AgentExecutionMode,
    riskLevel: 0,
    canWrite: false,
    canReview: false,
    canTest: false,
    availability: "available",
  };
}

class GentlemanAgentCatalog implements AgentCatalog {
  readonly provider: ProviderId = "gentlemanCli";
  private readonly _agents: AgentDescriptor[] = SDD_PHASES.map(makePhaseAgent);

  async listAgents(): Promise<AgentDescriptor[]> {
    return this._agents;
  }

  async getAgent(id: string): Promise<AgentDescriptor | undefined> {
    return this._agents.find((a) => a.id === id);
  }

  async findByPhase(phase: SddPhase): Promise<AgentDescriptor[]> {
    return this._agents.filter((a) => a.supportedPhases.includes(phase));
  }

  async findByCapability(capability: string): Promise<AgentDescriptor[]> {
    return this._agents.filter((a) => a.capabilities.includes(capability));
  }

  async findByMode(mode: AgentExecutionMode): Promise<AgentDescriptor[]> {
    return this._agents.filter((a) => a.executionMode === mode);
  }
}

type ExecaFn = typeof defaultExeca;

export class GentlemanProviderAdapter implements ProviderAdapter {
  readonly id: ProviderId = "gentlemanCli";
  private readonly _catalog = new GentlemanAgentCatalog();

  constructor(private readonly _execa: ExecaFn = defaultExeca) {}

  async checkAvailability(): Promise<ProviderAdapterStatus> {
    try {
      const result = await this._execa("gentle-ai", ["--version"], { reject: false });
      if (result.exitCode === 0) {
        return { status: "available", version: result.stdout.trim() };
      }
      return { status: "unsupported", reason: "gentle-ai CLI returned non-zero exit." };
    } catch {
      return { status: "unsupported", reason: "gentle-ai CLI not found." };
    }
  }

  getCatalog(): AgentCatalog {
    return this._catalog;
  }

  async execute(assignment: TaskAssignment): Promise<ExecutionResult> {
    const startedAt = new Date().toISOString();
    const avail = await this.checkAvailability();

    if (avail.status !== "available") {
      return {
        assignmentId: assignment.id,
        agent: assignment.executor,
        phase: assignment.phase,
        success: false,
        output: "",
        affectedFiles: [],
        artifacts: [],
        error: {
          code: "PROVIDER_UNAVAILABLE",
          message: avail.reason ?? "gentle-ai CLI not available.",
          recoverable: true,
        },
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    }

    // Gentleman validates SDD artifacts for the given phase — never writes product code.
    const result = await this._execa(
      "gentle-ai",
      ["validate", assignment.task.prompt, "--phase", assignment.phase],
      { reject: false },
    );

    return {
      assignmentId: assignment.id,
      agent: assignment.executor,
      phase: assignment.phase,
      success: result.exitCode === 0,
      output: result.stdout,
      affectedFiles: [],
      artifacts: [],
      error: result.exitCode !== 0
        ? {
            code: "EXECUTION_FAILED",
            message: result.stderr || "gentle-ai validate failed.",
            recoverable: false,
          }
        : undefined,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }
}
