import type { OrchestrateFn } from "./intake.js";
import { createIntentParser, type IntentParserOptions } from "./ops/intent.js";
import { CommandSchema, isMoneyCommand, type Command } from "./ops/schemas.js";
import { renderPreview } from "./ops/preview.js";
import { CrmClient, CrmError } from "./ops/crm-client.js";

/**
 * Business-operations engine (GRU_ENGINE=ops-crm). Turns a natural-language
 * Telegram order into a structured, validated business command and executes it
 * against the product API.
 *
 * SLICE 2: customer create/query run REAL against the creador_CRM API (via the
 * CRM_SERVICE_TOKEN). Money entities (invoice/sale) and bookings stay DRY-RUN
 * until the confirmation gate + name resolution land in later slices.
 */

export interface OpsRunnerOptions {
  parser?: IntentParserOptions;
  crm?: {
    baseUrl?: string;
    serviceToken?: string;
    /** Used until multi-tenant /negocio (later slice) provides one per session. */
    defaultBusinessId?: string;
  };
}

export function createOpsRunner(options: OpsRunnerOptions = {}): OrchestrateFn {
  const parseIntent = createIntentParser(options.parser);

  const crmReady = Boolean(options.crm?.baseUrl && options.crm?.serviceToken);
  const crm = crmReady
    ? new CrmClient({ baseUrl: options.crm!.baseUrl!, serviceToken: options.crm!.serviceToken! })
    : undefined;

  return async function orchestrateOps(prompt: string, _provider, opts): Promise<string> {
    let raw;
    try {
      raw = await parseIntent(prompt);
    } catch (err) {
      return `No pude interpretar la orden: ${err instanceof Error ? err.message : String(err)}`;
    }

    const parsed = CommandSchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "?"}: ${i.message}`).join("; ");
      return `Datos incompletos o inválidos: ${issues}`;
    }

    const cmd = parsed.data;
    if (cmd.entity === "unknown") return renderPreview(cmd);

    const preview = renderPreview(cmd);

    // The businessId comes from the session (/negocio, later slice) or a default.
    const businessId =
      (opts as { businessId?: string } | undefined)?.businessId ?? options.crm?.defaultBusinessId;

    // Slice 2: only customer ops execute for real. Everything else is dry-run.
    const executable = crm && cmd.entity === "customer";
    if (!executable) {
      const guard = isMoneyCommand(cmd) ? " [acción de dinero — requerirá doble confirmación]" : "";
      return `[DRY-RUN] ${preview}${guard}\n\n(Ejecución real de esta operación llega en una fase posterior.)`;
    }

    if (!businessId) {
      return "Falta seleccionar negocio. Configura DEFAULT_BUSINESS_ID (o usa /negocio en una fase posterior).";
    }

    try {
      return await executeCustomer(crm!, businessId, cmd);
    } catch (err) {
      if (err instanceof CrmError) return `❌ ${err.message}`;
      return `❌ Error ejecutando la operación: ${err instanceof Error ? err.message : String(err)}`;
    }
  };
}

async function executeCustomer(crm: CrmClient, businessId: string, cmd: Command): Promise<string> {
  if (cmd.entity !== "customer") return "Operación no soportada.";
  if (cmd.operation === "create") {
    const { nombre, telefono, email } = cmd.params;
    const row = await crm.createCustomer(businessId, { nombre, telefono, email });
    return `✅ Cliente dado de alta: ${nombre}${row?.id ? ` (id ${row.id})` : ""}`;
  }
  // query
  const all = await crm.listCustomers(businessId);
  const needle = cmd.params.nombre?.toLowerCase();
  const matches = needle ? all.filter((c) => c.nombre.toLowerCase().includes(needle)) : all;
  if (matches.length === 0) return "No encontré clientes con ese criterio.";
  return matches.slice(0, 20).map((c) => `• ${c.nombre}${c.telefono ? ` — ${c.telefono}` : ""}`).join("\n");
}
