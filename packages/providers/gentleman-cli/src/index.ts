import { execa } from "execa";
import { GruProvider, ProviderAvailability, ProviderTask, ProviderResult } from "../../../shared/src/ports/provider.js";
import { probeCommand } from "../../../shared/src/runtime/probe.js";

/**
 * SEC-01 (CWE-88): use `--` end-of-options separator before the prompt so
 * it cannot be parsed as a CLI flag by `gentle-ai consult`.
 * `gentle-ai consult -- <prompt>` is the safe form — the `--` terminates
 * option parsing and the prompt is treated as a positional argument.
 */
function sanitizePrompt(prompt: string): string {
  // Secondary guard: strip leading dashes in case the target binary ignores `--`.
  return prompt.replace(/^-+/, "");
}

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
      // SEC-01: use `--` end-of-options separator + strip leading dashes as
      // a defence-in-depth guard.
      const safePrompt = sanitizePrompt(task.prompt);
      const result = await execa("gentle-ai", ["consult", "--", safePrompt], { reject: false });
      return {
        providerId: this.id,
        success: result.exitCode === 0,
        output: result.stdout || result.stderr,
        error: result.exitCode === 0 ? undefined : result.stderr,
        exitCode: result.exitCode,
        executedCommand: `gentle-ai consult -- ${JSON.stringify(safePrompt)}`
      };
    } catch (error) {
      return { providerId: this.id, success: false, output: "", error: error instanceof Error ? error.message : String(error) };
    }
  }
}
