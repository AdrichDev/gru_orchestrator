import { execa } from "execa";
import { GruProvider, ProviderAvailability, ProviderTask, ProviderResult } from "../../../shared/src/ports/provider.js";
import { probeCommand } from "../../../shared/src/runtime/probe.js";

export class EngramProvider implements GruProvider {
  id = "engram" as const;
  canHandle(task: ProviderTask): boolean {
    return /recuerda|memoria|contexto|sem[aá]ntica/i.test(task.prompt);
  }
  async checkAvailability(): Promise<ProviderAvailability> {
    const probe = await probeCommand("engram", ["--version"]);
    return {
      providerId: this.id,
      available: probe.available,
      executable: "engram",
      version: probe.version,
      reason: probe.reason,
      installHint: "Instala gentle-engram/Engram y comprueba: engram projects list"
    };
  }
  async run(task: ProviderTask): Promise<ProviderResult> {
    try {
      const result = await execa("engram", ["search", task.prompt], { reject: false });
      return {
        providerId: this.id,
        success: result.exitCode === 0,
        output: result.stdout || result.stderr,
        error: result.exitCode === 0 ? undefined : result.stderr,
        exitCode: result.exitCode,
        executedCommand: `engram search ${JSON.stringify(task.prompt)}`
      };
    } catch (error) {
      return { providerId: this.id, success: false, output: "", error: error instanceof Error ? error.message : String(error) };
    }
  }
}
