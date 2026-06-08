import { execa } from "execa";
import { GruProvider, ProviderAvailability, ProviderTask, ProviderResult } from "../../../shared/src/ports/provider.js";
import { probeCommand } from "../../../shared/src/runtime/probe.js";

export class GentlemanCliProvider implements GruProvider {
  id = "gentlemanCli" as const;
  canHandle(task: ProviderTask): boolean {
    return /gentle|doctor|diagn[oó]stico|sync/i.test(task.prompt);
  }
  async checkAvailability(): Promise<ProviderAvailability> {
    const probe = await probeCommand("gentle-ai", ["--version"]);
    return {
      providerId: this.id,
      available: probe.available,
      executable: "gentle-ai",
      version: probe.version,
      reason: probe.reason,
      installHint: "Instala Gentle-AI y comprueba: gentle-ai doctor"
    };
  }
  async run(task: ProviderTask): Promise<ProviderResult> {
    try {
      const result = await execa("gentle-ai", ["consult", task.prompt], { reject: false });
      return {
        providerId: this.id,
        success: result.exitCode === 0,
        output: result.stdout || result.stderr,
        error: result.exitCode === 0 ? undefined : result.stderr,
        exitCode: result.exitCode,
        executedCommand: `gentle-ai consult ${JSON.stringify(task.prompt)}`
      };
    } catch (error) {
      return { providerId: this.id, success: false, output: "", error: error instanceof Error ? error.message : String(error) };
    }
  }
}
