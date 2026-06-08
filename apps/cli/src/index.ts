import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  getProviderStatuses,
  orchestrateTask,
  orchestrateAgenticTask,
  ProviderUnavailableError
} from "../../../packages/kernel/src/orchestrator/index.js";
import type { ProviderId } from "../../../packages/shared/src/ports/provider.js";
import type { SddPhase } from "../../../packages/shared/src/ports/agent.js";

function formatStatus(s: { available: boolean; status?: string; kind?: string }): string {
  if (s.available) {
    return s.status === "configured" ? "CONFIGURADO" : "READY";
  }
  if (s.status === "adapter-missing") return "HOST-MANAGED (PENDIENTE)";
  if (s.kind === "catalog") return "CATÁLOGO AUSENTE";
  if (s.kind === "sdk") return "ADAPTER MISSING";
  return s.status === "incompatible" ? "INCOMPATIBLE" : "MISSING";
}

async function runStatus(strict: boolean): Promise<void> {
  const statuses = await getProviderStatuses();
  console.log("\nEstado real de providers\n");
  console.table(statuses.map((s) => ({
    provider: s.providerId,
    kind: s.kind ?? "cli",
    estado: formatStatus(s),
    ejecutable: s.executable ?? "-",
    versión: s.version ?? "-",
    motivo: s.reason ?? "OK"
  })));

  const unavailable = statuses.filter((s) => !s.available);
  if (unavailable.length > 0) {
    console.log("\nAcciones necesarias:");
    for (const s of unavailable) {
      console.log(`- ${s.providerId}: ${s.installHint ?? s.reason}`);
    }
    if (strict) process.exitCode = 2;
  }
}

async function askForFallback(error: ProviderUnavailableError, prompt: string): Promise<void> {
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
    await orchestrateTask(prompt, normalized as ProviderId);
  } finally {
    rl.close();
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
    return;
  }

  const strict = args.includes("--strict");
  const agentic = args.includes("--agentic");
  const phaseIdx = args.indexOf("--phase");
  const phase: SddPhase = (phaseIdx !== -1 ? args[phaseIdx + 1] : "apply") as SddPhase;
  const sddIdx = args.indexOf("--sdd");
  const sddId = sddIdx !== -1 ? args[sddIdx + 1] : "current";

  const filteredArgs = args.filter((a, i) => {
    if (a === "--strict" || a === "--agentic") return false;
    if (a === "--phase" || a === "--sdd") return false;
    if (i > 0 && (args[i - 1] === "--phase" || args[i - 1] === "--sdd")) return false;
    return true;
  });
  const commandOrPrompt = filteredArgs.join(" ");

  if (["status", "/status", "doctor", "/doctor"].includes(commandOrPrompt.toLowerCase())) {
    await runStatus(strict);
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
