import { execa } from "execa";
import { GruProvider, ProviderAvailability, ProviderTask, ProviderResult } from "../../../shared/src/ports/provider.js";
import { probeCommand } from "../../../shared/src/runtime/probe.js";

export class RufloProvider implements GruProvider {
  id = "ruflo" as const;
  canHandle(task: ProviderTask): boolean {
    return /swarm|multiagente|paralelo/i.test(task.prompt);
  }
  async checkAvailability(): Promise<ProviderAvailability> {
    const probe = await probeCommand("pnpm", ["dlx", "ruflo@3.11.0", "--version"]);
    return {
      providerId: this.id,
      available: probe.available,
      executable: "pnpm dlx ruflo@3.11.0",
      version: probe.version,
      reason: probe.reason,
      installHint: "Ejecuta: pnpm dlx ruflo@3.11.0 init wizard"
    };
  }
  async run(task: ProviderTask): Promise<ProviderResult> {
    try {
      // Ruflo has no sync one-shot `run` command — delegate via workflow run (async delegation).
      // The workflow is queued for the Ruflo daemon; output contains the workflow ID and status.
      const result = await execa(
        "pnpm",
        ["dlx", "ruflo@3.11.0", "workflow", "run", "-t", "development", "--task", task.prompt],
        { reject: false }
      );
      return {
        providerId: this.id,
        success: result.exitCode === 0,
        output: result.stdout || result.stderr,
        error: result.exitCode === 0 ? undefined : result.stderr,
        exitCode: result.exitCode,
        executedCommand: `pnpm dlx ruflo@3.11.0 workflow run -t development --task ${JSON.stringify(task.prompt)}`
      };
    } catch (error) {
      return { providerId: this.id, success: false, output: "", error: error instanceof Error ? error.message : String(error) };
    }
  }
}
