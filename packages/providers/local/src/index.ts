import { GruProvider, ProviderAvailability, ProviderTask, ProviderResult } from "../../../shared/src/ports/provider.js";

export class LocalProvider implements GruProvider {
  id = "local" as const;
  canHandle(_task: ProviderTask): boolean { return true; }
  async checkAvailability(): Promise<ProviderAvailability> {
    return {
      providerId: this.id,
      available: false,
      reason: "No hay un runtime LLM local configurado. Gru no simulará la ejecución.",
      installHint: "Configura un runtime local real antes de habilitar el provider 'local'."
    };
  }
  async run(_task: ProviderTask): Promise<ProviderResult> {
    return { providerId: this.id, success: false, output: "", error: "Runtime local no configurado." };
  }
}
