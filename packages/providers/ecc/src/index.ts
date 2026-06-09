import { execa } from "execa";
import { GruProvider, ProviderAvailability, ProviderTask, ProviderResult } from "../../../shared/src/ports/provider.js";
import { probeCommand } from "../../../shared/src/runtime/probe.js";

export class EccProvider implements GruProvider {
  id = "ecc" as const;
  canHandle(task: ProviderTask): boolean {
    return /skill|hook|patr[oó]n|seguridad|cve/i.test(task.prompt);
  }
  async checkAvailability(): Promise<ProviderAvailability> {
    const probe = await probeCommand("pnpm", ["--package=ecc-universal", "dlx", "ecc", "--help"]);
    return {
      providerId: this.id,
      available: probe.available,
      status: probe.available ? "ready" : "missing",
      kind: "cli",
      executable: "pnpm --package=ecc-universal dlx ecc",
      version: probe.version,
      reason: probe.reason,
      installHint: "pnpm add -D ecc-universal  o verifica con: pnpm --package=ecc-universal dlx ecc doctor"
    };
  }
  async run(task: ProviderTask): Promise<ProviderResult> {
    try {
      const result = await execa("pnpm", ["--package=ecc-universal", "dlx", "ecc", "doctor"], { reject: false });
      // exit 0 = all ok, exit 1 = warnings — both are valid diagnostic results, not failures
      const success = (result.exitCode ?? 2) <= 1;
      return {
        providerId: this.id,
        success,
        output: result.stdout || result.stderr,
        error: success ? undefined : result.stderr,
        exitCode: result.exitCode,
        executedCommand: "pnpm --package=ecc-universal dlx ecc doctor"
      };
    } catch (error) {
      return { providerId: this.id, success: false, output: "", error: error instanceof Error ? error.message : String(error) };
    }
  }
}
