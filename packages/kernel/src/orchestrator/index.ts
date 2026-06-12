import fs from "fs";
import path from "path";
import { routeTask } from "../task-router/index.js";
import { classifyTask } from "../task-router/classifier.js";
import type { TaskClassification } from "../../../shared/src/ports/classification.js";
import { reviewDelegation } from "../../../skills/src/personas/devils-advocate/index.js";
import {
  GruProvider,
  ProviderId,
  ProviderTask,
  ProviderResult,
  RoutingDecision
} from "../../../shared/src/ports/provider.js";
import type { SddPhase } from "../../../shared/src/ports/agent.js";
import type { PlanResult, TaskAssignment } from "../../../shared/src/ports/orchestration.js";
import type { ReviewResult, TestEvidence } from "../../../shared/src/ports/results.js";
import { RufloProviderAdapter } from "../adapters/ruflo.js";
import { AwesomeCopilotProviderAdapter } from "../adapters/awesome-copilot.js";
import { DefaultProviderRegistry } from "../adapters/registry-agentic.js";
import { DefaultAgentResolver } from "../adapters/resolver.js";
import { DefaultSupervisionPolicy } from "../adapters/supervision.js";
import { evaluateAllGates } from "../gates/index.js";
import { createDelegationRegistry } from "../delegates/index.js";
import { resolveDelegate } from "../delegates/resolver.js";
import type { ProviderExecutionRequest } from "../../../shared/src/ports/delegation.js";

// Import Providers via workspace package names
import { RufloProvider } from "@gru/provider-ruflo";
import { GentlePiProvider } from "@gru/provider-gentle-pi";
import { GentlemanCliProvider } from "@gru/provider-gentleman-cli";
import { EccProvider } from "@gru/provider-ecc";
import { DeepagentsProvider } from "@gru/provider-deepagents";
import { EngramProvider } from "@gru/provider-engram";
import { AwesomeCopilotProvider } from "@gru/provider-awesome-copilot";
import { LocalProvider } from "@gru/provider-local";

// Extracted helpers
import { loadConfig, isProviderEnabled } from "./config.js";
import { applyPersonas } from "./personas.js";
import {
  buildReviewResultFromOutput,
  buildTestEvidenceFromOutput,
  parseWorkflowState,
  makeBlockedReview,
} from "./agentic-helpers.js";

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

export class HumanApprovalRequiredError extends Error {
  constructor(
    public readonly classification: TaskClassification,
    public readonly reasons: string[],
  ) {
    super(
      `La tarea requiere aprobación humana (nivel ${classification.level} — ${classification.levelName}). Motivos: ${reasons.join("; ")}`,
    );
    this.name = "HumanApprovalRequiredError";
  }
}

export class DelegationBlockedError extends Error {
  constructor(
    public readonly providerId: ProviderId,
    public readonly reason: string,
  ) {
    super(`Delegación bloqueada por Devil's Advocate: ${reason}`);
    this.name = "DelegationBlockedError";
  }
}

function approvalReasons(classification: TaskClassification): string[] {
  const reasons: string[] = [];
  const s = classification.signals;
  if (s.isIrreversible) reasons.push("acción irreversible/destructiva");
  if (s.touchesProduction) reasons.push("toca producción o despliegue");
  if (s.touchesSecurityOrAuth) reasons.push("toca seguridad o auth");
  if (s.touchesMainBranch) reasons.push("toca rama principal");
  if (s.generatesFinancialCost) reasons.push("genera gasto económico");
  if (s.touchesPersistentData) reasons.push("toca datos persistentes");
  if (classification.level >= 4) reasons.push("nivel 4 — Crítica");
  return reasons.length > 0 ? reasons : ["clasificación requiere aprobación"];
}

export interface OrchestrateOptions {
  /** Explicit human approval for tasks gated by risk classification. */
  approved?: boolean;
}

export async function getProviderStatuses() {
  return Promise.all(Object.values(PROVIDERS).map((provider) => provider.checkAvailability()));
}

export async function orchestrateTask(
  prompt: string,
  forcedProvider?: ProviderId,
  options: OrchestrateOptions = {},
): Promise<string> {
  const taskId = `task_${Date.now()}`;
  const task: ProviderTask = { taskId, prompt };
  const decision = routeTask(task);
  const { config, providers } = loadConfig();

  // ── Risk gate (mandatory, runs BEFORE any provider executes) ──────────────
  // Human-in-the-loop rule: destructive, production, security, main-branch,
  // financial-cost, and Level 4 tasks never run without explicit approval.
  const classification = classifyTask(prompt);
  if (
    (classification.requiresHumanApproval || classification.viability === "needs_approval") &&
    !options.approved
  ) {
    throw new HumanApprovalRequiredError(classification, approvalReasons(classification));
  }

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

  // ── Devil's Advocate pre-flight veto ───────────────────────────────────────
  const devilFinding = reviewDelegation({ prompt, providerId, decision, availability });
  if (devilFinding.blocked) {
    throw new DelegationBlockedError(providerId, devilFinding.reason ?? "motivo no especificado");
  }
  for (const warning of devilFinding.warnings) {
    console.warn(`[DEVIL] ${warning}`);
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
    classification: {
      level: classification.level,
      levelName: classification.levelName,
      viability: classification.viability,
      approvedByHuman: options.approved ?? false,
    },
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

export async function orchestrateAgenticTask(
  prompt: string,
  phase: SddPhase = "apply",
  sddId = "current",
  operation?: string,
): Promise<PlanResult> {
  const taskId = `agentic_${Date.now()}`;

  // R4: when operation is provided, use delegation registry for capability-based dispatch.
  if (operation) {
    const delegationRegistry = createDelegationRegistry();
    const resolution = await resolveDelegate(operation, delegationRegistry);

    if (resolution.blocked) {
      const cause = resolution.installHint
        ? `${resolution.reason} ${resolution.installHint}`
        : resolution.reason;
      return {
        plan: { id: taskId, description: prompt, assignments: [], gates: [], createdAt: new Date().toISOString() },
        executionResults: [],
        reviewResults: [],
        testEvidences: [],
        gateResults: [],
        approved: false,
        blockers: [`delegation:BLOCKED — ${cause}`],
      };
    }

    // Non-ruflo delegate: use delegation layer directly (no agentic pipeline).
    if (resolution.delegateId !== "ruflo") {
      const delegateReq: ProviderExecutionRequest = {
        taskId,
        prompt,
        operation,
        contextRefs: [],
        artifactRefs: [],
        constraints: [],
        metadata: { phase, sddId },
      };
      const result = await resolution.delegate.execute(delegateReq);
      const approved = result.status === "COMPLETED";
      const blocker = approved
        ? undefined
        : `${String(resolution.delegateId)}:${result.status} — ${result.error ?? "no output"}`;
      return {
        plan: { id: taskId, description: prompt, assignments: [], gates: [], createdAt: new Date().toISOString() },
        executionResults: [],
        reviewResults: [],
        testEvidences: [],
        gateResults: [],
        approved,
        blockers: blocker ? [blocker] : [],
      };
    }
    // delegateId === "ruflo": fall through to the existing agentic pipeline below.
  }

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
