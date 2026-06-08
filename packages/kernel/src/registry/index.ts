import fs from "fs";
import path from "path";
import YAML from "yaml";
import { pathToFileURL } from "url";
import { GruProvider, ProviderId } from "../../../shared/src/ports/provider.js";
import { ProvidersFile } from "../../../shared/src/types/config.js";

export class ProviderRegistry {
  private static instances: Map<ProviderId, GruProvider> = new Map();

  static async getProvider(providerId: ProviderId): Promise<GruProvider> {
    if (this.instances.has(providerId)) {
      return this.instances.get(providerId)!;
    }

    const providersPath = path.resolve(".gru/providers.yaml");
    if (!fs.existsSync(providersPath)) {
      throw new Error(`Archivo de proveedores no encontrado: ${providersPath}`);
    }

    const content = fs.readFileSync(providersPath, "utf-8");
    const parsed = YAML.parse(content) as ProvidersFile;
    const providerConfig = parsed.providers[providerId];

    if (!providerConfig || !providerConfig.path) {
      throw new Error(`Configuración o ruta no encontrada para el proveedor: ${providerId}`);
    }

    const absolutePath = path.resolve(providerConfig.path);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`El archivo de código del proveedor no existe en: ${absolutePath}`);
    }

    const fileUrl = pathToFileURL(absolutePath).href;

    try {
      const module = await import(fileUrl);
      const ProviderClass = module.Provider || module.default;
      if (!ProviderClass) {
        throw new Error(`El módulo del proveedor '${providerId}' no exporta 'Provider' ni un default.`);
      }

      const instance = new ProviderClass() as GruProvider;
      this.instances.set(providerId, instance);
      return instance;
    } catch (error: any) {
      throw new Error(`Error al importar dinámicamente el proveedor '${providerId}': ${error.message}`);
    }
  }
}
