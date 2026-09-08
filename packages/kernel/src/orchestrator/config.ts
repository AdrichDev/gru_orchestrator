import fs from "fs";
import path from "path";
import YAML from "yaml";
import {
  ProviderId,
} from "../../../shared/src/ports/provider.js";
import { ProjectConfig, ProvidersFile } from "../../../shared/src/types/config.js";
import { resolveConfigPath, resolveProvidersPath } from "../config/resolve.js";

// ── SEC-05: runtime schema guards ─────────────────────────────────────────────

const ROUTING_BOOLEAN_KEYS = [
  "enableGentlePi",
  "enableGentlemanCli",
  "enableECC",
  "enableDeepagents",
  "enableEngram",
  "enableAwesomeCopilot",
] as const;

const DEVIL_RIGIDITY_VALUES = ["advisory", "strict", "paranoid"] as const;

/**
 * Lightweight runtime validation for the parsed config.yaml shape.
 * Returns true when the shape is acceptable; false when something is
 * structurally wrong (malformed YAML → untrusted value).
 *
 * Rules:
 *   - Top level must be an object.
 *   - routing flags, if present, must be boolean or undefined.
 *   - routing.defaultMode, if present, must be a string.
 *   - devil section, if present, must have valid rigidity and minConfidence values.
 */
function isValidConfig(raw: unknown): raw is ProjectConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return false;
  const obj = raw as Record<string, unknown>;

  // project must be an object if present
  if ("project" in obj && (typeof obj.project !== "object" || obj.project === null)) return false;

  // routing must be an object if present
  if ("routing" in obj) {
    const routing = obj.routing;
    if (typeof routing !== "object" || routing === null || Array.isArray(routing)) return false;
    const r = routing as Record<string, unknown>;

    // All boolean routing flags must be boolean or absent
    for (const key of ROUTING_BOOLEAN_KEYS) {
      if (key in r && typeof r[key] !== "boolean") return false;
    }

    // defaultMode must be a string if present
    if ("defaultMode" in r && typeof r.defaultMode !== "string") return false;
  }

  // devil section must be an object with valid fields if present
  if ("devil" in obj) {
    const devil = obj.devil;
    if (typeof devil !== "object" || devil === null || Array.isArray(devil)) return false;
    const d = devil as Record<string, unknown>;

    if ("rigidity" in d && !DEVIL_RIGIDITY_VALUES.includes(d.rigidity as (typeof DEVIL_RIGIDITY_VALUES)[number])) {
      return false;
    }
    if ("minConfidence" in d && typeof d.minConfidence !== "number") return false;
  }

  return true;
}

/**
 * Lightweight runtime validation for the parsed providers.yaml shape.
 * Returns true when each provider entry is an object (or absent).
 */
function isValidProviders(raw: unknown): raw is ProvidersFile {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return false;
  const obj = raw as Record<string, unknown>;
  if (!("providers" in obj)) return false;
  const providers = obj.providers;
  if (typeof providers !== "object" || providers === null || Array.isArray(providers)) return false;

  // Each provider entry must be an object
  for (const val of Object.values(providers as Record<string, unknown>)) {
    if (typeof val !== "object" || val === null || Array.isArray(val)) return false;
  }
  return true;
}

// ── End SEC-05 ─────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ProjectConfig = {
  project: { name: "gru-orchestrator" },
  routing: {
    defaultMode: "normal",
    enableGentlePi: true,
    enableGentlemanCli: true,
    enableECC: true,
    enableDeepagents: true,
    enableEngram: true,
    enableAwesomeCopilot: true
  },
  // devil defaults: rigidity "strict" + minConfidence 30 reproduces the original behavior exactly.
  devil: {
    rigidity: "strict",
    minConfidence: 30,
  },
};

const DEFAULT_PROVIDERS: ProvidersFile = { providers: {} };

export function loadConfig(): { config: ProjectConfig; providers: ProvidersFile } {
  try {
    const configPath = resolveConfigPath();
    const providersPath = resolveProvidersPath();

    const configContent = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf-8") : "";
    const providersContent = fs.existsSync(providersPath) ? fs.readFileSync(providersPath, "utf-8") : "";

    let config = DEFAULT_CONFIG;
    if (configContent) {
      const parsed = YAML.parse(configContent) as unknown;
      if (isValidConfig(parsed)) {
        config = parsed;
      } else {
        // SEC-05: malformed config → fall back to hardcoded defaults and warn
        process.stderr.write(
          `[gru] WARN: config.yaml has unexpected shape — falling back to defaults. ` +
          `Verify routing flags are boolean and providers entries are objects.\n`
        );
      }
    }

    let providers = DEFAULT_PROVIDERS;
    if (providersContent) {
      const parsed = YAML.parse(providersContent) as unknown;
      if (isValidProviders(parsed)) {
        providers = parsed;
      } else {
        // SEC-05: malformed providers → fall back to hardcoded defaults and warn
        process.stderr.write(
          `[gru] WARN: providers.yaml has unexpected shape — falling back to defaults. ` +
          `Verify each provider entry is an object.\n`
        );
      }
    }

    return { config, providers };
  } catch (err) {
    return { config: DEFAULT_CONFIG, providers: DEFAULT_PROVIDERS };
  }
}

export function isProviderEnabled(providerId: ProviderId, config: ProjectConfig, providers: ProvidersFile): boolean {
  const keyMap: Record<ProviderId, { routingKey: keyof ProjectConfig["routing"] | null; providerKey: string }> = {
    local: { routingKey: null, providerKey: "local" },
    gentlePi: { routingKey: "enableGentlePi", providerKey: "gentlePi" },
    gentlemanCli: { routingKey: "enableGentlemanCli", providerKey: "gentlemanCli" },
    ecc: { routingKey: "enableECC", providerKey: "ecc" },
    deepagents: { routingKey: "enableDeepagents", providerKey: "deepagents" },
    engram: { routingKey: "enableEngram", providerKey: "engram" },
    awesomeCopilot: { routingKey: "enableAwesomeCopilot", providerKey: "awesomeCopilot" }
  };

  const meta = keyMap[providerId];
  if (!meta) return false;

  // Providers with no routingKey (e.g. "local") are governed solely by providers.yaml.
  const configEnabled = meta.routingKey === null ? true : config.routing[meta.routingKey] !== false;
  const providerDef = providers.providers[meta.providerKey];
  const providerEnabled = providerDef ? providerDef.enabled !== false : true;

  return configEnabled && providerEnabled;
}
