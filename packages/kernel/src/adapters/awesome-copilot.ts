import fs from "fs";
import path from "path";
import YAML from "yaml";
import { AwesomeCopilotProvider } from "@gru/provider-awesome-copilot";
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

const DEFAULT_AC_ROOT = path.resolve(
  process.env.GRU_AWESOME_COPILOT_PATH ?? "vendor/awesome-copilot"
);

interface AcFrontmatter {
  name?: string;
  description?: string;
  "argument-hint"?: string;
  compatibility?: string;
  license?: string;
  [key: string]: unknown;
}

/**
 * A skill is invocable if it declares an argument-hint — meaning it has a
 * defined invocation pattern and can produce structured output when called.
 * Skills without argument-hint are context-only instruction files.
 */
function isInvocable(fm: AcFrontmatter): boolean {
  const hint = fm["argument-hint"];
  return typeof hint === "string" && hint.trim().length > 0;
}

const INVOCABLE_PHASES: SddPhase[] = ["explore", "design", "apply", "verify"];

function parseFrontmatter(filePath: string): AcFrontmatter | null {
  let content = "";
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") return null;

  const bodyLines: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") break;
    bodyLines.push(lines[i]);
  }

  try {
    return (YAML.parse(bodyLines.join("\n")) as AcFrontmatter) ?? null;
  } catch {
    return null;
  }
}

function buildDescriptor(dirName: string, filePath: string): AgentDescriptor {
  const fm = parseFrontmatter(filePath);

  if (!fm) {
    return makeContextOnly(dirName, filePath, "Invalid or missing frontmatter");
  }

  if (!isInvocable(fm)) {
    return makeContextOnly(dirName, filePath, "No argument-hint — context-only skill, not executable");
  }

  return {
    id: dirName,
    provider: "awesomeCopilot",
    sourcePath: filePath,
    name: fm.name ?? dirName,
    description: typeof fm.description === "string" ? fm.description : "",
    capabilities: deriveCapabilities(fm),
    supportedPhases: INVOCABLE_PHASES,
    tools: [],
    skills: [],
    executionMode: "write",
    riskLevel: 2,
    canWrite: true,
    canReview: false,
    canTest: false,
    availability: "available",
    metadata: { argumentHint: fm["argument-hint"] },
  };
}

function makeContextOnly(id: string, sourcePath: string, reason: string): AgentDescriptor {
  return {
    id,
    provider: "awesomeCopilot",
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

function deriveCapabilities(fm: AcFrontmatter): string[] {
  const desc = (fm.description ?? "").toLowerCase();
  const caps: string[] = [];
  if (/security|audit|compliance|owasp/.test(desc)) caps.push("security_analysis");
  if (/test|validat|quality/.test(desc)) caps.push("quality_assurance");
  if (/architecture|design|pattern/.test(desc)) caps.push("architecture_guidance");
  if (/document|readme|spec/.test(desc)) caps.push("documentation");
  if (/migration|refactor/.test(desc)) caps.push("refactoring");
  return caps;
}

export class AwesomeCopilotAgentCatalog implements AgentCatalog {
  readonly provider: ProviderId = "awesomeCopilot";
  private cache: AgentDescriptor[] | null = null;

  constructor(private readonly root: string) {}

  async listAgents(): Promise<AgentDescriptor[]> {
    if (!this.cache) this.cache = this.scan();
    return this.cache;
  }

  private scan(): AgentDescriptor[] {
    const skillsDir = path.join(this.root, "skills");
    if (!fs.existsSync(skillsDir)) return [];

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    } catch {
      return [];
    }

    const results: AgentDescriptor[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillFile = path.join(skillsDir, entry.name, "SKILL.md");
      if (!fs.existsSync(skillFile)) continue;
      results.push(buildDescriptor(entry.name, skillFile));
    }
    return results;
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

export class AwesomeCopilotProviderAdapter implements ProviderAdapter {
  readonly id: ProviderId = "awesomeCopilot";
  private readonly catalog: AwesomeCopilotAgentCatalog;
  // Reuse existing GruProvider for the real execution mechanism (search + return skill content)
  private readonly gruProvider: AwesomeCopilotProvider;

  constructor(root?: string) {
    const rootPath = root ?? DEFAULT_AC_ROOT;
    this.catalog = new AwesomeCopilotAgentCatalog(rootPath);
    this.gruProvider = new AwesomeCopilotProvider(rootPath);
  }

  async checkAvailability(): Promise<ProviderAdapterStatus> {
    const avail = await this.gruProvider.checkAvailability();
    if (!avail.available) {
      return { status: "unavailable", reason: avail.reason };
    }
    const agents = await this.catalog.listAgents();
    const invocable = agents.filter((a) => a.availability === "available").length;
    return { status: "available", agentCount: invocable };
  }

  getCatalog(): AgentCatalog {
    return this.catalog;
  }

  /**
   * Executes an AwesomeCopilot skill by delegating to the existing GruProvider
   * run() mechanism: retrieves the skill's content and returns it as structured output.
   * Only invocable skills (argument-hint present) can reach this method via the resolver.
   */
  async execute(assignment: TaskAssignment): Promise<ExecutionResult> {
    const skillId = assignment.executor.id;
    const started = new Date().toISOString();

    const result = await this.gruProvider.run({
      taskId: assignment.id,
      prompt: `${skillId} ${assignment.task.prompt}`,
    });

    return {
      assignmentId: assignment.id,
      agent: assignment.executor,
      phase: assignment.phase,
      success: result.success,
      output: result.output,
      affectedFiles: [],
      artifacts: [],
      error: result.success
        ? undefined
        : { code: "EXECUTION_FAILED", message: result.error ?? "AC provider returned no output", recoverable: true },
      startedAt: started,
      finishedAt: new Date().toISOString(),
    };
  }
}
