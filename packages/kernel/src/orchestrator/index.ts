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

// Import Providers
import { RufloProvider } from "../../../providers/ruflo/src/index.js";
import { GentlePiProvider } from "../../../providers/gentle-pi/src/index.js";
import { GentlemanCliProvider } from "../../../providers/gentleman-cli/src/index.js";
import { EccProvider } from "../../../providers/ecc/src/index.js";
import { DeepagentsProvider } from "../../../providers/deepagents/src/index.js";
import { EngramProvider } from "../../../providers/engram/src/index.js";
import { AwesomeCopilotProvider } from "../../../providers/awesome-copilot/src/index.js";
import { LocalProvider } from "../../../providers/local/src/index.js";

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
