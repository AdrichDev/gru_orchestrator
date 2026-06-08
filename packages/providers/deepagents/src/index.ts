import { createDeepAgent } from "deepagents";
import type { GruProvider, ProviderAvailability, ProviderTask, ProviderResult } from "../../../shared/src/ports/provider.js";
import { detectHarness } from "../../../shared/src/runtime/harness.js";

export type DeepAgentsMode = "host-managed" | "sdk-managed" | "disabled";

function resolveMode(): DeepAgentsMode {
  const envMode = process.env.GRU_DEEPAGENTS_MODE;
  if (envMode === "host-managed") return "host-managed";
  if (envMode === "sdk-managed") return "sdk-managed";
  if (envMode === "disabled") return "disabled";
  // auto: host-managed if inside a known harness, sdk-managed otherwise
  return detectHarness() !== "standalone" ? "host-managed" : "sdk-managed";
}

export class DeepagentsProvider implements GruProvider {
  id = "deepagents" as const;

  canHandle(task: ProviderTask): boolean {
    return /workflow|checkpoint|persistente|larga duraci[oó]n/i.test(task.prompt);
  }

  async checkAvailability(): Promise<ProviderAvailability> {
    const mode = resolveMode();
    const harness = detectHarness();

    if (mode === "disabled") {
      return {
        providerId: this.id,
        available: false,
        status: "missing",
        kind: "sdk",
        reason: "DeepAgents desactivado (GRU_DEEPAGENTS_MODE=disabled).",
        installHint: "Cambia GRU_DEEPAGENTS_MODE a sdk-managed o auto para activarlo."
      };
    }

    // host-managed: harness detected, but HarnessAdapter not yet implemented
    if (mode === "host-managed") {
      return {
        providerId: this.id,
        available: false,
        status: "adapter-missing",
        kind: "sdk",
        reason: `DeepAgents host-managed requiere HarnessAdapter (pendiente). Harness: ${harness}. No se abre conexión SDK secundaria.`,
        installHint: "Implementa HarnessAdapter. Ver openspec/harness-runtime-abstraction-sdd.md."
      };
    }

    // sdk-managed: standalone, requires configured provider + key
    const provider = process.env.GRU_DEEPAGENTS_PROVIDER;
    const apiKeyEnv = process.env.GRU_DEEPAGENTS_API_KEY_ENV;

    if (!provider || !apiKeyEnv) {
      return {
        providerId: this.id,
        available: false,
        status: "missing",
        kind: "sdk",
        reason: "sdk-managed requiere GRU_DEEPAGENTS_PROVIDER y GRU_DEEPAGENTS_API_KEY_ENV.",
        installHint: "Configura GRU_DEEPAGENTS_PROVIDER (ej: anthropic) y GRU_DEEPAGENTS_API_KEY_ENV (ej: ANTHROPIC_API_KEY)."
      };
    }

    const apiKey = process.env[apiKeyEnv];
    if (!apiKey) {
      return {
        providerId: this.id,
        available: false,
        status: "missing",
        kind: "sdk",
        reason: `sdk-managed: ${apiKeyEnv} no configurada.`,
        installHint: `Configura ${apiKeyEnv} en el entorno.`
      };
    }

    return {
      providerId: this.id,
      available: true,
      status: "ready",
      kind: "sdk",
      executable: `deepagents SDK (${provider})`,
      version: "1.10.2"
    };
  }

  async run(task: ProviderTask): Promise<ProviderResult> {
    const availability = await this.checkAvailability();
    if (!availability.available) {
      return {
        providerId: this.id,
        success: false,
        output: "",
        error: availability.reason ?? "DeepAgents no disponible.",
        exitCode: 1
      };
    }

    const provider = process.env.GRU_DEEPAGENTS_PROVIDER!;
    const model = process.env.GRU_DEEPAGENTS_MODEL ?? `${provider}:default`;

    try {
      const agent = createDeepAgent({ model });
      const result = await agent.invoke({ messages: [{ role: "user", content: task.prompt }] });
      const messages: unknown[] = ((result as unknown) as Record<string, unknown[]>).messages ?? [];
      const last = messages[messages.length - 1] as Record<string, unknown> | undefined;
      const output =
        typeof last?.content === "string"
          ? last.content
          : JSON.stringify(last?.content ?? result);
      return {
        providerId: this.id,
        success: true,
        output,
        exitCode: 0,
        executedCommand: `createDeepAgent(${model}).invoke(${JSON.stringify(task.prompt.slice(0, 60))})`
      };
    } catch (error) {
      return {
        providerId: this.id,
        success: false,
        output: "",
        error: error instanceof Error ? error.message : String(error),
        exitCode: 1
      };
    }
  }
}
