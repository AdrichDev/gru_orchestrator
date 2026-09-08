import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  getProviderStatuses,
  orchestrateTask,
  orchestrateAgenticTask,
  ProviderUnavailableError,
  HumanApprovalRequiredError,
  DelegationBlockedError
} from "../../../packages/kernel/src/orchestrator/index.js";
import { loadConfig } from "../../../packages/kernel/src/orchestrator/config.js";
import { isOptionalOrDisabled, formatProviderStatus } from "../../../packages/kernel/src/orchestrator/status.js";
import type { ProviderId } from "../../../packages/shared/src/ports/provider.js";
import type { SddPhase } from "../../../packages/shared/src/ports/agent.js";
import type { DelegationProviderId, ContextReference } from "../../../packages/shared/src/ports/delegation.js";
import { createDelegationOrchestrator } from "../../../packages/kernel/src/delegates/index.js";
import { runInit, printInitSummary, isValidRuntime, ALL_RUNTIMES } from "./init.js";
import type { InstallScope, RuntimeId } from "./init.js";
import { printBanner } from "./banner.js";

async function runStatus(strict: boolean): Promise<void> {
  const statuses = await getProviderStatuses();
  const { providers: providersFile } = loadConfig();
  const providersConfig = providersFile.providers as Record<string, { enabled?: boolean }>;

  console.log("\nEstado real de providers\n");
  console.table(statuses.map((s) => ({
    provider: s.providerId,
    kind: s.kind ?? "cli",
    estado: formatProviderStatus(s, s.providerId as ProviderId, providersConfig),
    ejecutable: s.executable ?? "-",
    versión: s.version ?? "-",
    motivo: s.reason ?? "OK"
  })));

  // Only genuinely required-but-missing providers appear here.
  // Disabled-in-config and optional host-managed/sdk providers are excluded.
  const actionRequired = statuses.filter(
    (s) => !s.available && !isOptionalOrDisabled(s.providerId as ProviderId, s, providersConfig)
  );

  if (actionRequired.length > 0) {
    console.log("\nAcciones necesarias:");
    for (const s of actionRequired) {
      console.log(`- ${s.providerId}: ${s.installHint ?? s.reason}`);
    }
    if (strict) process.exitCode = 2;
  }
}

async function askForHumanApproval(error: HumanApprovalRequiredError, prompt: string): Promise<void> {
  console.error(`\n[APROBACIÓN REQUERIDA] Nivel ${error.classification.level} — ${error.classification.levelName}`);
  console.error(`Motivos: ${error.reasons.join("; ")}`);

  if (!process.stdin.isTTY) {
    console.error("Entorno no interactivo: la tarea NO se ejecuta sin aprobación humana explícita.");
    process.exitCode = 2;
    return;
  }

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question("¿Apruebas la ejecución de esta tarea? (si/NO): ");
    if (!/^s[ií]$/i.test(answer.trim())) {
      console.log("Tarea cancelada por el usuario. No se ha ejecutado nada.");
      process.exitCode = 2;
      return;
    }
  } finally {
    rl.close();
  }

  try {
    await orchestrateTask(prompt, undefined, { approved: true });
  } catch (error2) {
    if (error2 instanceof ProviderUnavailableError) {
      await askForFallback(error2, prompt, true);
      return;
    }
    console.error("Error real al orquestar la tarea:", error2);
    process.exitCode = 1;
  }
}

async function askForFallback(error: ProviderUnavailableError, prompt: string, approved = false): Promise<void> {
  console.error(`\n[BLOCKED] ${error.message}`);
  if (error.installHint) console.error(`Solución: ${error.installHint}`);

  if (!process.stdin.isTTY || error.fallbacks.length === 0) {
    process.exitCode = 2;
    return;
  }

  const statuses = await getProviderStatuses();
  const availableIds = new Set(statuses.filter((status) => status.available).map((status) => status.providerId));
  const candidates = error.fallbacks.filter((id) => availableIds.has(id));
  if (candidates.length === 0) {
    console.error("No hay ningún fallback real disponible. No se ejecutará nada.");
    process.exitCode = 2;
    return;
  }

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(
      `Providers alternativos instalados: ${candidates.join(", ")}. ¿Cuál quieres usar? (nombre/cancelar): `
    );
    const normalized = answer.trim();
    if (!candidates.includes(normalized as ProviderId)) {
      console.log("Ejecución cancelada. No se ha simulado ninguna respuesta.");
      process.exitCode = 2;
      return;
    }
    await orchestrateTask(prompt, normalized as ProviderId, { approved });
  } finally {
    rl.close();
  }
}

async function runDelegate(args: string[]): Promise<void> {
  // Usage: gru delegate <provider> --operation <op> --task "<text>"
  //                     [--json] [--context <ref>] [--constraint <c>] [--timeout <ms>]
  //
  // <provider> is optional: omit it to auto-resolve the first available provider
  // that supports <operation>.
  //
  // NOTE: this path does NOT run the full risk-classification + Devil's Advocate
  // + human-approval pipeline from orchestrateTask. It is intended for explicit,
  // scripted invocations where the caller owns the risk decision.

  const restArgs = args.slice(1); // drop "delegate"

  // The first positional arg (if not a flag) is the optional providerId.
  let providerId: DelegationProviderId | undefined;
  const firstArg = restArgs[0];
  if (firstArg && !firstArg.startsWith("--")) {
    providerId = firstArg as DelegationProviderId;
  }

  const operationIdx = restArgs.indexOf("--operation");
  const taskIdx = restArgs.indexOf("--task");
  const timeoutIdx = restArgs.indexOf("--timeout");
  const jsonFlag = restArgs.includes("--json");

  if (operationIdx === -1 || taskIdx === -1) {
    console.error("Uso: gru delegate [<provider>] --operation <op> --task \"<text>\" [--json] [--context <ref>] [--constraint <c>] [--timeout <ms>]");
    console.error("  <provider>  — id del provider (ecc|gentlePi|…); omitir para auto-resolver");
    console.error("  --operation — id de operación (consult|review|implement|plan|…)");
    console.error("  --task      — descripción de la tarea (texto)");
    console.error("  --context   — referencia de contexto portable (repetible)");
    console.error("  --constraint — restricción adicional (repetible)");
    console.error("  --timeout   — timeout en ms (opcional)");
    console.error("  --json      — output en JSON");
    process.exitCode = 2;
    return;
  }

  const operation = restArgs[operationIdx + 1];
  const taskPrompt = restArgs[taskIdx + 1];
  const timeoutMs = timeoutIdx !== -1 ? parseInt(restArgs[timeoutIdx + 1] ?? "0", 10) || undefined : undefined;

  if (!operation || operation.startsWith("--")) {
    console.error("gru delegate: --operation requires a value.");
    process.exitCode = 2;
    return;
  }

  if (!taskPrompt || taskPrompt.startsWith("--")) {
    console.error("gru delegate: --task requires a value.");
    process.exitCode = 2;
    return;
  }

  // Collect repeatable --context and --constraint flags
  const contextRefs: Array<{ kind: ContextReference["kind"]; ref: string }> = [];
  const constraints: string[] = [];
  for (let i = 0; i < restArgs.length; i++) {
    if (restArgs[i] === "--context" && restArgs[i + 1]) {
      contextRefs.push({ kind: "artifact", ref: restArgs[i + 1] });
    }
    if (restArgs[i] === "--constraint" && restArgs[i + 1]) {
      constraints.push(restArgs[i + 1]);
    }
  }

  try {
    const orchestrator = createDelegationOrchestrator();
    const result = await orchestrator.delegate({
      operation,
      prompt: taskPrompt,
      providerId,
      contextRefs,
      constraints,
      timeoutMs,
    });

    if (jsonFlag) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`\n[delegate] provider: ${result.providerId}`);
      console.log(`[delegate] status:   ${result.status}`);
      if (result.output) console.log(`[delegate] output:\n${result.output}`);
      if (result.error) console.error(`[delegate] error:    ${result.error}`);
      if (result.artifacts && result.artifacts.length > 0) {
        console.log(`[delegate] artifacts: ${result.artifacts.join(", ")}`);
      }
      if (result.externalExecutionId) {
        console.log(`[delegate] externalId: ${result.externalExecutionId}`);
      }
    }

    if (result.status !== "COMPLETED" && result.status !== "SUBMITTED" && result.status !== "RUNNING") {
      process.exitCode = 2;
    }
  } catch (err) {
    console.error("[delegate] Error:", err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("Uso:");
    console.log('  pnpm gru "<prompt>"');
    console.log('  pnpm gru --agentic "<prompt>" [--phase apply]');
    console.log("  pnpm gru status   (también /status)");
    console.log("  pnpm gru doctor   (alias de status)");
    console.log("  pnpm gru init [--scope project|global] [--runtime <list>] [--force] [--awesome-copilot]");
    console.log(`    --runtime: comma-separated list of runtimes (${ALL_RUNTIMES.join("|")})`);
    console.log("    --runtime all: scaffold all runtimes");
    console.log("    default runtime when non-interactive: claude");
    console.log("    --awesome-copilot: download the awesome-copilot skills catalog (~100MB) into ~/.gru/awesome-copilot");
    console.log("    --skills: alias for --awesome-copilot");
    console.log('  pnpm gru delegate [<provider>] --operation <op> --task "<text>" [--json] [--context <ref>] [--constraint <c>] [--timeout <ms>]');
    console.log("    <provider>: id del provider (ecc|gentlePi|…); omitir para auto-resolver");
    console.log("    --operation: id de operación soportada por el provider");
    console.log("    --task:      texto de la tarea a delegar");
    return;
  }

  const strict = args.includes("--strict");
  const agentic = args.includes("--agentic");
  const phaseIdx = args.indexOf("--phase");
  const phase: SddPhase = (phaseIdx !== -1 ? args[phaseIdx + 1] : "apply") as SddPhase;
  const sddIdx = args.indexOf("--sdd");
  const sddId = sddIdx !== -1 ? args[sddIdx + 1] : "current";

  const filteredArgs = args.filter((a, i) => {
    if (a === "--strict" || a === "--agentic" || a === "--force") return false;
    if (a === "--awesome-copilot" || a === "--skills") return false;
    if (a === "--phase" || a === "--sdd" || a === "--scope" || a === "--runtime") return false;
    if (i > 0 && (args[i - 1] === "--phase" || args[i - 1] === "--sdd" || args[i - 1] === "--scope" || args[i - 1] === "--runtime")) return false;
    return true;
  });
  const commandOrPrompt = filteredArgs.join(" ");

  // ── delegate subcommand — must check raw args (not filteredArgs) ──────────
  // `gru delegate [<provider>] --operation <op> --task "<text>" ...`
  // This check uses the original args to preserve all flags for runDelegate().
  if (args[0] === "delegate" || args[0] === "/delegate") {
    await runDelegate(args);
    return;
  }

  if (["status", "/status", "doctor", "/doctor"].includes(commandOrPrompt.toLowerCase())) {
    await runStatus(strict);
    return;
  }

  if (["init", "/init"].includes(commandOrPrompt.toLowerCase())) {
    const scopeIdx = args.indexOf("--scope");
    let scopeValue: InstallScope | undefined;
    if (scopeIdx !== -1) {
      const raw = args[scopeIdx + 1];
      const validScopes: ReadonlyArray<InstallScope> = ["project", "global"];
      if (!validScopes.includes(raw as InstallScope)) {
        console.error(
          `gru init: invalid --scope value "${raw}". Valid values: project, global.`
        );
        process.exitCode = 2;
        return;
      }
      scopeValue = raw as InstallScope;
    }

    // Parse --runtime flag
    const runtimeIdx = args.indexOf("--runtime");
    let runtimeValues: RuntimeId[] | undefined;
    if (runtimeIdx !== -1) {
      const raw = args[runtimeIdx + 1];
      if (!raw || raw.startsWith("--")) {
        console.error("gru init: --runtime requires a value.");
        process.exitCode = 2;
        return;
      }
      if (raw.trim().toLowerCase() === "all") {
        runtimeValues = [...ALL_RUNTIMES];
      } else {
        const parts = raw.split(",").map((s) => s.trim().toLowerCase());
        const invalid = parts.filter((p) => !isValidRuntime(p));
        if (invalid.length > 0) {
          console.error(
            `gru init: invalid --runtime value(s): ${invalid.join(", ")}. ` +
            `Valid values: ${ALL_RUNTIMES.join(", ")}, all.`
          );
          process.exitCode = 2;
          return;
        }
        runtimeValues = parts as RuntimeId[];
      }
    }

    const force = args.includes("--force");

    // --awesome-copilot / --skills: opt into downloading the catalog
    const awesomeCopilotFlag = args.includes("--awesome-copilot") || args.includes("--skills")
      ? true
      : undefined; // undefined → resolve interactively if TTY, else skip

    // Print Gru ASCII banner at the top of init
    printBanner();

    try {
      const result = await runInit({
        scope: scopeValue,
        force,
        runtimes: runtimeValues,
        awesomeCopilot: awesomeCopilotFlag,
      });
      printInitSummary(result);
    } catch (err) {
      console.error("gru init failed:", err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
    return;
  }

  if (agentic) {
    try {
      const result = await orchestrateAgenticTask(commandOrPrompt, phase, sddId);
      console.log(`\n[Agentic] ${result.approved ? "APROBADO ✓" : "RECHAZADO ✗"}`);
      if (result.blockers.length > 0) {
        console.log("Blockers:");
        for (const b of result.blockers) console.log(`  - ${b}`);
      }
      console.log("\nGates:");
      for (const g of result.gateResults) {
        console.log(`  ${g.gate}: ${g.status}${g.reason ? ` — ${g.reason}` : ""}`);
      }
      if (!result.approved) process.exitCode = 2;
    } catch (error) {
      console.error("[Agentic] BLOQUEADO:", error instanceof Error ? error.message : String(error));
      process.exitCode = 2;
    }
    return;
  }

  try {
    await orchestrateTask(commandOrPrompt);
  } catch (error) {
    if (error instanceof HumanApprovalRequiredError) {
      await askForHumanApproval(error, commandOrPrompt);
      return;
    }
    if (error instanceof DelegationBlockedError) {
      console.error(`\n[BLOCKED] ${error.message}`);
      process.exitCode = 2;
      return;
    }
    if (error instanceof ProviderUnavailableError) {
      await askForFallback(error, commandOrPrompt);
      return;
    }
    console.error("Error real al orquestar la tarea:", error);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
