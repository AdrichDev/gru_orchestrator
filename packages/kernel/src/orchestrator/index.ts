import fs from "fs";
import path from "path";
import YAML from "yaml";
import { execa } from "execa";
import { routeTask } from "../task-router/index.js";
import {
  GruProvider,
  ProviderId,
  PersonaId,
  ProviderTask,
  ProviderResult,
  RoutingDecision
} from "../../../shared/src/ports/provider.js";
import { ProjectConfig, ProvidersFile } from "../../../shared/src/types/config.js";
import type { SddPhase } from "../../../shared/src/ports/agent.js";
import type { PlanResult, TaskAssignment } from "../../../shared/src/ports/orchestration.js";
import type { ReviewResult, TestEvidence } from "../../../shared/src/ports/results.js";
import { RufloProviderAdapter } from "../adapters/ruflo.js";
import { AwesomeCopilotProviderAdapter } from "../adapters/awesome-copilot.js";
import { DefaultProviderRegistry } from "../adapters/registry-agentic.js";
import { DefaultAgentResolver } from "../adapters/resolver.js";
import { DefaultSupervisionPolicy } from "../adapters/supervision.js";
import { evaluateAllGates } from "../gates/index.js";

// Import Providers via workspace package names
import { RufloProvider } from "@gru/provider-ruflo";
import { GentlePiProvider } from "@gru/provider-gentle-pi";
import { GentlemanCliProvider } from "@gru/provider-gentleman-cli";
import { EccProvider } from "@gru/provider-ecc";
import { DeepagentsProvider } from "@gru/provider-deepagents";
import { EngramProvider } from "@gru/provider-engram";
import { AwesomeCopilotProvider } from "@gru/provider-awesome-copilot";
import { LocalProvider } from "@gru/provider-local";

// Import Personas
import { applyCaveman } from "../../../skills/src/personas/caveman/index.js";
import { applyDevilsAdvocate } from "../../../skills/src/personas/devils-advocate/index.js";

export const PROVIDERS: Record<ProviderId, GruProvider> = {
  ruflo: new RufloProvider(),
  gentlePi: new GentlePiProvider(),
  gentlemanCli: new GentlemanCliProvider(),
  ecc: new EccProvider(),
  deepagents: new DeepagentsProvider(),
  engram: new EngramProvider(),
  awesomeCopilot: new AwesomeCopilotProvider(),
  local: new LocalProvider()
};

function loadConfig(): { config: ProjectConfig; providers: ProvidersFile } {
  try {
    const configPath = path.resolve(".gru/config.yaml");
    const providersPath = path.resolve(".gru/providers.yaml");

    const configContent = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf-8") : "";
    const providersContent = fs.existsSync(providersPath) ? fs.readFileSync(providersPath, "utf-8") : "";

    return {
      config: configContent ? (YAML.parse(configContent) as ProjectConfig) : {
        project: { name: "gru-orchestrator" },
        routing: {
          defaultMode: "normal",
          enableRuflo: true,
          enableGentlePi: true,
          enableGentlemanCli: true,
          enableECC: true,
          enableDeepagents: true,
          enableEngram: true,
          enableAwesomeCopilot: true
        }
      },
      providers: providersContent ? (YAML.parse(providersContent) as ProvidersFile) : { providers: {} }
    };
  } catch (err) {
    return {
      config: {
        project: { name: "gru-orchestrator" },
        routing: {
          defaultMode: "normal",
          enableRuflo: true,
          enableGentlePi: true,
          enableGentlemanCli: true,
          enableECC: true,
          enableDeepagents: true,
          enableEngram: true,
          enableAwesomeCopilot: true
        }
      },
      providers: { providers: {} }
    };
  }
}

function isProviderEnabled(providerId: ProviderId, config: ProjectConfig, providers: ProvidersFile): boolean {
  if (providerId === "local") return true;

  const keyMap: Record<Exclude<ProviderId, "local">, { routingKey: keyof ProjectConfig["routing"]; providerKey: string }> = {
    ruflo: { routingKey: "enableRuflo", providerKey: "ruflo" },
    gentlePi: { routingKey: "enableGentlePi", providerKey: "gentlePi" },
    gentlemanCli: { routingKey: "enableGentlemanCli", providerKey: "gentlemanCli" },
    ecc: { routingKey: "enableECC", providerKey: "ecc" },
    deepagents: { routingKey: "enableDeepagents", providerKey: "deepagents" },
    engram: { routingKey: "enableEngram", providerKey: "engram" },
    awesomeCopilot: { routingKey: "enableAwesomeCopilot", providerKey: "awesomeCopilot" }
  };

  const meta = keyMap[providerId];
  if (!meta) return false;

  const configEnabled = config.routing[meta.routingKey] !== false;
  const providerDef = providers.providers[meta.providerKey];
  const providerEnabled = providerDef ? providerDef.enabled !== false : true;

  return configEnabled && providerEnabled;
}

function applyPersonas(output: string, prompt: string, personas: PersonaId[]): string {
  let finalOutput = output;
  for (const persona of personas) {
    if (persona === "caveman") {
      finalOutput = applyCaveman(finalOutput);
    } else if (persona === "devilsAdvocate") {
      finalOutput = applyDevilsAdvocate(finalOutput, prompt);
    }
  }
  return finalOutput;
}

export class ProviderUnavailableError extends Error {
  constructor(
    public readonly providerId: ProviderId,
    public readonly reason: string,
    public readonly installHint?: string,
    public readonly fallbacks: ProviderId[] = []
  ) {
    super(`Provider '${providerId}' no disponible: ${reason}`);
    this.name = "ProviderUnavailableError";
  }
}

export async function getProviderStatuses() {
  return Promise.all(Object.values(PROVIDERS).map((provider) => provider.checkAvailability()));
}

export async function orchestrateTask(prompt: string, forcedProvider?: ProviderId): Promise<string> {
  const taskId = `task_${Date.now()}`;
  const task: ProviderTask = { taskId, prompt };
  const decision = routeTask(task);
  const { config, providers } = loadConfig();

  const providerId = forcedProvider ?? decision.provider;
  if (!isProviderEnabled(providerId, config, providers)) {
    throw new ProviderUnavailableError(
      providerId,
      "Está deshabilitado en .gru/config.yaml o .gru/providers.yaml.",
      "Habilita explícitamente el provider antes de ejecutarlo.",
      decision.fallbacks
    );
  }

  const provider = PROVIDERS[providerId];
  const availability = await provider.checkAvailability();
  if (!availability.available) {
    throw new ProviderUnavailableError(
      providerId,
      availability.reason ?? "No se pudo verificar la instalación.",
      availability.installHint,
      decision.fallbacks
    );
  }

  console.log(`Gru recibe tarea: ${prompt}`);
  console.log(`Provider elegido: ${providerId} (Confianza: ${decision.confidence}%)`);
  if (decision.personas.length > 0) console.log(`Personas aplicadas: ${decision.personas.join(", ")}`);
  console.log("Ejecutando provider real...");

  const startedAt = new Date();
  const result = await provider.run(task);
  const finishedAt = new Date();
  const finalOutput = result.success
    ? applyPersonas(result.output, prompt, decision.personas)
    : result.output;

  fs.mkdirSync("runs", { recursive: true });
  const runLogPath = path.join("runs", `run_${Date.now()}_${taskId}.json`);
  const runLog = {
    taskId,
    prompt,
    decision: {
      routedProvider: decision.provider,
      executedProvider: providerId,
      personas: decision.personas,
      confidence: decision.confidence,
      reasons: decision.reasons
    },
    execution: {
      real: true,
      success: result.success,
      command: result.executedCommand,
      exitCode: result.exitCode,
      error: result.error,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString()
    },
    rawOutput: result.output,
    finalOutput,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(runLogPath, JSON.stringify(runLog, null, 2), "utf-8");

  if (!result.success) {
    throw new Error(`El provider '${providerId}' falló: ${result.error || result.output || "error desconocido"}`);
  }

  console.log(`\nResultado final:\n----------------\n${finalOutput}\n----------------`);
  console.log(`Resultado guardado en ${runLogPath}`);
  return finalOutput;
}

// ─── Agentic pipeline ────────────────────────────────────────────────────────

function buildReviewResultFromOutput(
  assignment: TaskAssignment,
  output: string,
  success: boolean
): ReviewResult {
  const approved = success && !/(BLOCKER|FAIL|REJECT|ERROR)/i.test(output);
  const blockers = approved ? [] : ["Review did not approve — see output"];
  return {
    assignmentId: assignment.id,
    reviewer: assignment.reviewer,
    approved,
    findings: [],
    blockers,
    suggestions: [],
    completedAt: new Date().toISOString(),
  };
}

function buildTestEvidenceFromOutput(
  assignment: TaskAssignment,
  output: string,
  success: boolean
): TestEvidence {
  const passed = success && !/(FAIL|ERROR|REGRESSION)/i.test(output);
  return {
    assignmentId: assignment.id,
    tester: assignment.tester,
    passed,
    suites: [],
    regressions: passed ? [] : ["Tester reported failure — see output"],
    completedAt: new Date().toISOString(),
  };
}

function parseWorkflowState(result: { artifacts?: string[] }): string {
  const tag = (result.artifacts ?? []).find((a) => a.startsWith("ruflo:workflow:"));
  return tag ? (tag.split(":")[3] ?? "unknown") : "unknown";
}

function makeBlockedReview(assignment: TaskAssignment): ReturnType<typeof buildReviewResultFromOutput> {
  return {
    assignmentId: assignment.id,
    reviewer: assignment.reviewer,
    approved: false,
    findings: [],
    blockers: ["Execution did not complete — review blocked"],
    suggestions: [],
    completedAt: new Date().toISOString(),
  };
}

export async function orchestrateAgenticTask(
  prompt: string,
  phase: SddPhase = "apply",
  sddId = "current"
): Promise<PlanResult> {
  const taskId = `agentic_${Date.now()}`;

  const policy = new DefaultSupervisionPolicy();
  const registry = new DefaultProviderRegistry();
  // Gru registers all providers. Resolver picks executor from any; reviewer+tester always Ruflo.
  registry.register(new AwesomeCopilotProviderAdapter());
  registry.register(new RufloProviderAdapter());

  const resolver = new DefaultAgentResolver(registry, policy);

  const gruTask = { id: taskId, prompt, metadata: {} };
  const assignment = await resolver.resolve(gruTask, phase);

  console.log(`\n[Agentic] executor  → ${assignment.executor.id}`);
  console.log(`[Agentic] reviewer  → ${assignment.reviewer.id}`);
  console.log(`[Agentic] tester    → ${assignment.tester.id}`);

  const rufloAdapter = registry.get("ruflo")!;

  // Step 1: executor — must reach COMPLETED before pipeline advances
  const executionResult = await rufloAdapter.execute({
    ...assignment,
    task: { ...gruTask, metadata: { role: "executor" } },
  });
  const execState = parseWorkflowState(executionResult);
  console.log(`[Agentic] execution ${execState} (success=${executionResult.success})`);

  if (!executionResult.success) {
    const gates = evaluateAllGates(assignment, executionResult, makeBlockedReview(assignment), undefined, sddId);
    return {
      plan: { id: taskId, description: prompt, assignments: [assignment], gates: assignment.gates, createdAt: new Date().toISOString() },
      executionResults: [executionResult],
      reviewResults: [],
      testEvidences: [],
      gateResults: gates,
      approved: false,
      blockers: [`execution:${execState} — ${executionResult.error?.message ?? "no output"}`],
    };
  }

  // Step 2: reviewer — only reached when executor COMPLETED
  const reviewerResult = await rufloAdapter.execute({
    ...assignment,
    task: { ...gruTask, metadata: { role: "reviewer", previousOutput: executionResult.output } },
  });
  const reviewerState = parseWorkflowState(reviewerResult);
  console.log(`[Agentic] reviewer  ${reviewerState} (success=${reviewerResult.success})`);

  if (!reviewerResult.success) {
    const gates = evaluateAllGates(assignment, executionResult, makeBlockedReview(assignment), undefined, sddId);
    return {
      plan: { id: taskId, description: prompt, assignments: [assignment], gates: assignment.gates, createdAt: new Date().toISOString() },
      executionResults: [executionResult],
      reviewResults: [],
      testEvidences: [],
      gateResults: gates,
      approved: false,
      blockers: [`reviewer:${reviewerState} — ${reviewerResult.error?.message ?? "no output"}`],
    };
  }

  const reviewResult = buildReviewResultFromOutput(assignment, reviewerResult.output, reviewerResult.success);
  console.log(`[Agentic] review    ${reviewResult.approved ? "approved" : "rejected"}`);

  if (!reviewResult.approved) {
    const gates = evaluateAllGates(assignment, executionResult, reviewResult, undefined, sddId);
    return {
      plan: { id: taskId, description: prompt, assignments: [assignment], gates: assignment.gates, createdAt: new Date().toISOString() },
      executionResults: [executionResult],
      reviewResults: [reviewResult],
      testEvidences: [],
      gateResults: gates,
      approved: false,
      blockers: reviewResult.blockers,
    };
  }

  // Step 3: tester — only reached when reviewer COMPLETED and approved
  const testerResult = await rufloAdapter.execute({
    ...assignment,
    task: { ...gruTask, metadata: { role: "tester", previousOutput: executionResult.output } },
  });
  const testerState = parseWorkflowState(testerResult);
  console.log(`[Agentic] tester    ${testerState} (success=${testerResult.success})`);

  if (!testerResult.success) {
    const gates = evaluateAllGates(assignment, executionResult, reviewResult, undefined, sddId);
    return {
      plan: { id: taskId, description: prompt, assignments: [assignment], gates: assignment.gates, createdAt: new Date().toISOString() },
      executionResults: [executionResult],
      reviewResults: [reviewResult],
      testEvidences: [],
      gateResults: gates,
      approved: false,
      blockers: [`tester:${testerState} — ${testerResult.error?.message ?? "no output"}`],
    };
  }

  const testEvidence = buildTestEvidenceFromOutput(assignment, testerResult.output, testerResult.success);
  console.log(`[Agentic] test      ${testEvidence.passed ? "passed" : "failed"}`);

  const gates = evaluateAllGates(assignment, executionResult, reviewResult, testEvidence, sddId);
  const failedRequired = gates.filter((g) => {
    const gate = assignment.gates.find((ag) => ag.id === g.gate);
    return gate?.required && (g.status === "failed" || g.status === "blocked");
  });

  fs.mkdirSync("runs", { recursive: true });
  const runLogPath = path.join("runs", `agentic_${taskId}.json`);
  fs.writeFileSync(runLogPath, JSON.stringify({ taskId, prompt, phase, assignment, executionResult, reviewResult, testEvidence, gates }, null, 2), "utf-8");

  return {
    plan: { id: taskId, description: prompt, assignments: [assignment], gates: assignment.gates, createdAt: new Date().toISOString() },
    executionResults: [executionResult],
    reviewResults: [reviewResult],
    testEvidences: [testEvidence],
    gateResults: gates,
    approved: failedRequired.length === 0,
    blockers: failedRequired.map((g) => `${g.gate}: ${g.reason ?? g.status}`),
  };
}
