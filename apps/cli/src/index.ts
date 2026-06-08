import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  getProviderStatuses,
  orchestrateTask,
  ProviderUnavailableError
} from "../../../packages/kernel/src/orchestrator/index.js";
import type { ProviderId } from "../../../packages/shared/src/ports/provider.js";

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
    console.log("  pnpm gru status   (también /status)");
    console.log("  pnpm gru doctor   (alias de status)");
    return;
  }

  const strict = args.includes("--strict");
  const filteredArgs = args.filter((a) => a !== "--strict");
  const commandOrPrompt = filteredArgs.join(" ");
  if (["status", "/status", "doctor", "/doctor"].includes(commandOrPrompt.toLowerCase())) {
    await runStatus(strict);
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
