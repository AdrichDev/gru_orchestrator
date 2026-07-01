import fs from "fs";
import path from "path";
import YAML from "yaml";
import { execa } from "execa";
import type {
  AgentCatalog,
  AgentDescriptor,
  SddPhase,
  AgentExecutionMode,
  AgentAvailability,
} from "../../../shared/src/ports/agent.js";
import type {
  ProviderAdapter,
  ProviderAdapterStatus,
  TaskAssignment,
} from "../../../shared/src/ports/orchestration.js";
import type { ExecutionResult } from "../../../shared/src/ports/results.js";
import type { ProviderId } from "../../../shared/src/ports/provider.js";

// Ruflo agent catalog path is env-only. No local-path default — the agentic adapter
// uses pnpm dlx ruflo@3.16.2 for execution; the catalog scan is optional.
// When GRU_RUFLO_PATH is unset or the directory is absent, getAgentCatalog() returns []
// and checkAvailability() reports unavailable. No crash.
const DEFAULT_RUFLO_PATH = process.env.GRU_RUFLO_PATH ?? "";

interface SkillSpec {
  name?: string;
  type?: string;
  description?: string;
  capabilities?: string[];
  tools?: string;
  priority?: string;
  [key: string]: unknown;
}

// Parse two consecutive YAML frontmatter blocks separated by ---
function parseDoubleFrontmatter(content: string): {
  wrapper: Record<string, unknown>;
  spec: SkillSpec | null;
} {
  const lines = content.split("\n");
  const blocks: string[] = [];
  let inBlock = false;
  const current: string[] = [];

  for (const line of lines) {
    if (line.trim() === "---") {
      if (inBlock) {
        blocks.push(current.join("\n"));
        current.length = 0;
        inBlock = false;
        if (blocks.length >= 2) break;
      } else {
        inBlock = true;
      }
    } else if (inBlock) {
      current.push(line);
    }
  }

  let wrapper: Record<string, unknown> = {};
  let spec: SkillSpec | null = null;
  try {
    wrapper = blocks[0] ? (YAML.parse(blocks[0]) as Record<string, unknown>) ?? {} : {};
  } catch { /* invalid YAML — keep empty */ }
  try {
    spec = blocks[1] ? (YAML.parse(blocks[1]) as SkillSpec) ?? null : null;
  } catch { /* invalid YAML — treat as no spec */ }

  return { wrapper, spec };
}

interface TypeRoles {
  canWrite: boolean;
  canReview: boolean;
  canTest: boolean;
  executionMode: AgentExecutionMode;
  phases: SddPhase[];
}

const TYPE_ROLES: Record<string, TypeRoles> = {
  developer:    { canWrite: true,  canReview: false, canTest: false, executionMode: "write",    phases: ["apply", "verify"] },
  development:  { canWrite: true,  canReview: false, canTest: false, executionMode: "write",    phases: ["apply", "verify"] },
  validator:    { canWrite: false, canReview: true,  canTest: true,  executionMode: "review",   phases: ["verify"] },
  reviewer:     { canWrite: false, canReview: true,  canTest: false, executionMode: "review",   phases: ["verify"] },
  tester:       { canWrite: false, canReview: false, canTest: true,  executionMode: "test",     phases: ["verify"] },
  security:     { canWrite: false, canReview: true,  canTest: true,  executionMode: "review",   phases: ["design", "verify"] },
  architecture: { canWrite: false, canReview: false, canTest: false, executionMode: "plan",     phases: ["explore", "proposal", "spec", "design"] },
  coordinator:  { canWrite: false, canReview: false, canTest: false, executionMode: "plan",     phases: ["explore", "proposal", "spec", "design", "tasks", "apply", "verify", "sync"] },
  planner:      { canWrite: false, canReview: false, canTest: false, executionMode: "plan",     phases: ["explore", "proposal", "spec", "design", "tasks"] },
  researcher:   { canWrite: false, canReview: false, canTest: false, executionMode: "research", phases: ["explore", "proposal"] },
};

const PRIORITY_RISK: Record<string, 0 | 1 | 2 | 3 | 4> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function parseSkillFile(dirName: string, filePath: string): AgentDescriptor {
  const basePath = path.dirname(path.dirname(filePath)); // .agents/skills parent
  const isAgentDir = dirName.startsWith("agent-");
  let content = "";

  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return makeUnavailable(dirName, filePath, "Cannot read SKILL.md");
  }

  const { spec } = parseDoubleFrontmatter(content);

  // Not an agent-* dir or no spec block → context-only skill
  if (!isAgentDir || !spec || !spec.type) {
    return makeUnavailable(dirName, filePath, "Context-only skill, not executable");
  }

  const typeKey = (spec.type as string).toLowerCase();
  const roles: TypeRoles = TYPE_ROLES[typeKey] ?? {
    canWrite: false, canReview: false, canTest: false,
    executionMode: "research", phases: [],
  };

  const capabilities: string[] = Array.isArray(spec.capabilities)
    ? (spec.capabilities as string[]).map(String)
    : [];

  const tools: string[] = typeof spec.tools === "string"
    ? spec.tools.split(",").map((t) => t.trim())
    : [];

  const riskLevel: 0 | 1 | 2 | 3 | 4 =
    PRIORITY_RISK[(spec.priority as string)?.toLowerCase() ?? ""] ?? 2;

  return {
    id: dirName,
    provider: "ruflo",
    sourcePath: filePath,
    name: spec.name ?? dirName,
    description: spec.description ?? "",
    capabilities,
    supportedPhases: roles.phases,
    tools,
    skills: [],
    executionMode: roles.executionMode,
    riskLevel,
    canWrite: roles.canWrite,
    canReview: roles.canReview,
    canTest: roles.canTest,
    availability: "available",
  };
}

function makeUnavailable(id: string, sourcePath: string, reason: string): AgentDescriptor {
  return {
    id,
    provider: "ruflo",
    sourcePath,
    name: id,
    description: reason,
    capabilities: [],
    supportedPhases: [],
    tools: [],
    skills: [],
    executionMode: "research",
    riskLevel: 0,
    canWrite: false,
    canReview: false,
    canTest: false,
    availability: "unavailable",
    metadata: { reason },
  };
}

function scanAgents(basePath: string): AgentDescriptor[] {
  const skillsDir = path.join(basePath, ".agents", "skills");
  if (!fs.existsSync(skillsDir)) return [];

  const results: AgentDescriptor[] = [];
  let entries: fs.Dirent[] = [];

  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    // Only agent-* directories are treated as executable agents
    if (!entry.name.startsWith("agent-")) continue;

    const skillFile = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillFile)) continue;

    results.push(parseSkillFile(entry.name, skillFile));
  }

  return results;
}

export class RufloAgentCatalog implements AgentCatalog {
  readonly provider: ProviderId = "ruflo";
  private cache: AgentDescriptor[] | null = null;

  constructor(private readonly basePath: string) {}

  async listAgents(): Promise<AgentDescriptor[]> {
    if (!this.cache) this.cache = scanAgents(this.basePath);
    return this.cache;
  }

  async getAgent(id: string): Promise<AgentDescriptor | undefined> {
    return (await this.listAgents()).find((a) => a.id === id);
  }

  async findByPhase(phase: SddPhase): Promise<AgentDescriptor[]> {
    return (await this.listAgents())
      .filter((a) => a.availability === "available" && a.supportedPhases.includes(phase))
      .slice(0, 50);
  }

  async findByCapability(capability: string): Promise<AgentDescriptor[]> {
    const lower = capability.toLowerCase();
    return (await this.listAgents())
      .filter((a) => a.availability === "available" && a.capabilities.some((c) => c.toLowerCase().includes(lower)))
      .slice(0, 50);
  }

  async findByMode(mode: AgentExecutionMode): Promise<AgentDescriptor[]> {
    return (await this.listAgents())
      .filter((a) => a.availability === "available" && a.executionMode === mode)
      .slice(0, 50);
  }
}

export class RufloProviderAdapter implements ProviderAdapter {
  readonly id: ProviderId = "ruflo";
  private readonly catalog: RufloAgentCatalog;

  constructor(basePath?: string) {
    this.catalog = new RufloAgentCatalog(basePath ?? DEFAULT_RUFLO_PATH);
  }

  async checkAvailability(): Promise<ProviderAdapterStatus> {
    const skillsDir = path.join(this.catalog["basePath"], ".agents", "skills");
    if (!fs.existsSync(skillsDir)) {
      return { status: "unavailable", reason: `Ruflo .agents/skills not found at ${skillsDir}` };
    }
    const agents = await this.catalog.listAgents();
    const available = agents.filter((a) => a.availability === "available").length;
    return { status: "available", agentCount: available };
  }

  getCatalog(): AgentCatalog {
    return this.catalog;
  }

  async execute(assignment: TaskAssignment): Promise<ExecutionResult> {
    const role = (assignment.task.metadata?.role as string) ?? "executor";
    const agentId =
      role === "reviewer" ? assignment.reviewer.id
      : role === "tester"   ? assignment.tester.id
      : assignment.executor.id;

    const agentShortName = agentId.replace(/^agent-/, "");
    const previousOutput = (assignment.task.metadata?.previousOutput as string) ?? "";

    // T-7 fix counterpart: reviewer/tester MUST emit an explicit structured
    // verdict so the fail-closed gates in agentic-helpers.ts can approve. Without
    // the marker the gate stays rejected by design (no silent fail-open).
    const prompt =
      role === "executor"
        ? `$agent-${agentShortName}: ${assignment.task.prompt}`
        : role === "reviewer"
          ? `$agent-${agentShortName}: Review this output for quality and correctness:\n\n${previousOutput}\n\nWhen done, end your response with a line on its own: "VERDICT: APPROVED" if the work is correct and meets quality standards, otherwise "VERDICT: REJECTED" followed by the blockers.`
          : `$agent-${agentShortName}: Validate and test this implementation:\n\n${previousOutput}\n\nWhen done, end your response with a line on its own: "TESTS: PASS" if all tests pass, otherwise "TESTS: FAIL" followed by the failures.`;

    const template =
      role === "reviewer" ? "code-review"
      : role === "tester"  ? "testing"
      : "development";

    const agent =
      role === "reviewer" ? assignment.reviewer
      : role === "tester"  ? assignment.tester
      : assignment.executor;

    const started = new Date().toISOString();

    // ── Step 1: submit workflow ───────────────────────────────────────────────
    let submitRaw = "";
    try {
      const submitResult = await execa(
        "pnpm",
        ["dlx", "ruflo@3.16.2", "workflow", "run", "-t", template, "--task", prompt, "--format", "json"],
        { reject: false }
      );
      submitRaw = submitResult.stdout || submitResult.stderr;

      if (submitResult.exitCode !== 0) {
        return makeFailedResult(assignment.id, agent, assignment.phase, "EXECUTION_FAILED",
          `Workflow submission failed: ${submitRaw}`, false, started);
      }
    } catch (err) {
      return makeFailedResult(assignment.id, agent, assignment.phase, "EXECUTION_FAILED",
        String(err), false, started);
    }

    // Extract workflowId — stdout has ONNX preamble before JSON block
    let workflowId: string | undefined;
    const jsonMatch = submitRaw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as { workflowId?: string };
        workflowId = parsed.workflowId;
      } catch { /* malformed JSON */ }
    }

    if (!workflowId) {
      return makeFailedResult(assignment.id, agent, assignment.phase, "EXECUTION_FAILED",
        `[SUBMITTED] Could not parse workflowId from: ${submitRaw.slice(0, 200)}`, false, started);
    }

    // ── Step 2: poll until terminal state ─────────────────────────────────────
    const timeoutMs = parseInt(process.env.GRU_RUFLO_TIMEOUT_MS ?? "60000", 10);
    const pollMs   = parseInt(process.env.GRU_RUFLO_POLL_MS    ?? "5000",  10);

    const lifecycle = await pollWorkflow(workflowId, timeoutMs, pollMs);

    const success = lifecycle.state === "completed";
    const stateTag = `[${lifecycle.state.toUpperCase()}]`;

    const errorCode: import("../../../shared/src/ports/harness.js").GruError["code"] =
      lifecycle.state === "timeout"    ? "TIMEOUT"
      : lifecycle.state === "unknown"  ? "CAPABILITY_UNSUPPORTED"
      : "EXECUTION_FAILED";

    return {
      assignmentId: assignment.id,
      agent,
      phase: assignment.phase,
      success,
      output: success ? lifecycle.output : `${stateTag} workflow:${workflowId} — ${lifecycle.output}`,
      affectedFiles: [],
      artifacts: [`ruflo:workflow:${workflowId}:${lifecycle.state}`],
      error: success ? undefined : {
        code: errorCode,
        message: lifecycle.output,
        recoverable: lifecycle.state === "timeout",
      },
      startedAt: started,
      finishedAt: new Date().toISOString(),
    };
  }
}

// ── Workflow lifecycle ────────────────────────────────────────────────────────

export type RufloWorkflowState =
  | "submitted"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "timeout"
  | "unknown";

interface WorkflowPollResult {
  state: RufloWorkflowState;
  output: string;
}

function mapStatus(raw: string | undefined): RufloWorkflowState {
  switch ((raw ?? "").toLowerCase()) {
    case "completed": case "done": case "success": return "completed";
    case "failed":    case "error":                return "failed";
    case "cancelled": case "canceled": case "stopped": return "failed";
    case "running":                                return "running";
    case "pending":   case "queued":               return "queued";
    default:                                       return "unknown";
  }
}

async function pollWorkflow(
  workflowId: string,
  timeoutMs: number,
  pollMs: number,
): Promise<WorkflowPollResult> {
  interface StatusJson {
    status?: string;
    progress?: number;
    completedSteps?: number;
    totalSteps?: number;
    output?: string;
    result?: string;
    error?: string;
  }

  async function fetchStatus(): Promise<StatusJson | null> {
    try {
      const r = await execa(
        "pnpm",
        ["dlx", "ruflo@3.16.2", "workflow", "status", workflowId, "--format", "json"],
        { reject: false },
      );
      const m = (r.stdout || "").match(/\{[\s\S]*\}/);
      if (!m) return null;
      return JSON.parse(m[0]) as StatusJson;
    } catch {
      return null;
    }
  }

  const deadline = Date.now() + timeoutMs;

  // ── Early probe: detect stuck workflow before committing to full poll loop ──
  // Ruflo's daemon workers (map/audit/optimize) are background analysis jobs.
  // They do NOT process 'type: task' workflow steps. Actual task execution
  // requires MCP + an active Claude Code instance. Without MCP, progress
  // stays at 0 indefinitely regardless of daemon state.
  await new Promise<void>((r) => setTimeout(r, Math.min(pollMs, 5000)));
  const earlyStatus = await fetchStatus();

  if (earlyStatus !== null) {
    // Terminal state reached quickly (fast executor)
    const earlyState = mapStatus(earlyStatus.status);
    if (earlyState === "completed") {
      const out = earlyStatus.output ?? earlyStatus.result
        ?? `Workflow ${workflowId} completed.`;
      return { state: "completed", output: out };
    }
    if (earlyState === "failed") {
      return { state: "failed", output: earlyStatus.error ?? `Workflow ${workflowId} failed.` };
    }

    // progress=0 + completedSteps=0 after initial wait → daemon present but task steps not consumed.
    // Continuing to poll will never help — return UNSUPPORTED immediately.
    if ((earlyStatus.progress ?? 0) === 0 && (earlyStatus.completedSteps ?? 0) === 0) {
      return {
        state: "unknown",
        output:
          `[UNSUPPORTED] Workflow ${workflowId} registered in Ruflo store but task steps not processing. ` +
          `Ruflo's workflow engine requires MCP integration to execute task steps — ` +
          `the daemon background workers (map/audit/optimize) do not consume 'type:task' steps. ` +
          `Enable via: ruflo mcp start + connect Claude Code to the MCP server.`,
      };
    }
  }

  // ── Standard poll loop for cases where progress IS advancing ────────────────
  while (Date.now() < deadline) {
    await new Promise<void>((r) => setTimeout(r, pollMs));
    const json = await fetchStatus();
    if (!json) continue;

    const state = mapStatus(json.status);
    if (state === "completed") {
      const out = json.output ?? json.result
        ?? `Workflow ${workflowId} completed. Steps: ${json.completedSteps ?? "?"}/${json.totalSteps ?? "?"}.`;
      return { state, output: out };
    }
    if (state === "failed") {
      return { state: "failed", output: json.error ?? `Workflow ${workflowId} failed.` };
    }
    // Check for re-stuck after initial progress
    if ((json.progress ?? 0) === 0 && (json.completedSteps ?? 0) === 0) {
      return {
        state: "unknown",
        output: `[UNSUPPORTED] Workflow ${workflowId} stopped advancing. MCP integration required.`,
      };
    }
  }

  return {
    state: "timeout",
    output: `Workflow ${workflowId} did not complete within ${timeoutMs}ms.`,
  };
}

function makeFailedResult(
  assignmentId: string,
  agent: import("../../../shared/src/ports/agent.js").AgentDescriptor,
  phase: import("../../../shared/src/ports/agent.js").SddPhase,
  code: import("../../../shared/src/ports/harness.js").GruError["code"],
  message: string,
  recoverable: boolean,
  startedAt: string,
): ExecutionResult {
  return {
    assignmentId,
    agent,
    phase,
    success: false,
    output: message,
    affectedFiles: [],
    artifacts: [],
    error: { code, message, recoverable },
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}
