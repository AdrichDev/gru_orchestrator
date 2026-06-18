import fs from "fs";
import path from "path";
import YAML from "yaml";
import {
  ProviderId,
} from "../../../shared/src/ports/provider.js";
import { ProjectConfig, ProvidersFile } from "../../../shared/src/types/config.js";
import { resolveConfigPath, resolveProvidersPath } from "../config/resolve.js";

export function loadConfig(): { config: ProjectConfig; providers: ProvidersFile } {
  try {
    const configPath = resolveConfigPath();
    const providersPath = resolveProvidersPath();

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

export function isProviderEnabled(providerId: ProviderId, config: ProjectConfig, providers: ProvidersFile): boolean {
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
