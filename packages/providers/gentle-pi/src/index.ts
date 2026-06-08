import { execa } from "execa";
import { GruProvider, ProviderAvailability, ProviderTask, ProviderResult } from "../../../shared/src/ports/provider.js";
import { probeCommand } from "../../../shared/src/runtime/probe.js";

export class GentlePiProvider implements GruProvider {
  id = "gentlePi" as const;
  canHandle(task: ProviderTask): boolean {
    return /sdd|openspec|tdd|adr|arn[eé]s/i.test(task.prompt);
  }
  async checkAvailability(): Promise<ProviderAvailability> {
    const probe = await probeCommand("pi", ["--version"]);
    return {
      providerId: this.id,
      available: probe.available,
      executable: "pi",
      version: probe.version,
      reason: probe.reason,
      installHint: "Instala Pi y después: pi install npm:gentle-pi"
    };
  }
  async run(task: ProviderTask): Promise<ProviderResult> {
    try {
      const result = await execa("pi", ["-p", task.prompt], { reject: false });
      return {
        providerId: this.id,
        success: result.exitCode === 0,
        output: result.stdout || result.stderr,
        error: result.exitCode === 0 ? undefined : result.stderr,
        exitCode: result.exitCode,
        executedCommand: `pi -p ${JSON.stringify(task.prompt)}`
      };
    } catch (error) {
      return { providerId: this.id, success: false, output: "", error: error instanceof Error ? error.message : String(error) };
    }
  }
}
