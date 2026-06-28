import type { OrchestrateFn } from "./intake.js";
import { createIntentParser, type IntentParserOptions } from "./ops/intent.js";
import { CommandSchema, isMoneyCommand, type Command } from "./ops/schemas.js";
import { renderPreview } from "./ops/preview.js";
import { CrmClient, CrmError } from "./ops/crm-client.js";
import { findRecentDuplicate } from "./ops/dedup.js";

/**
 * Business-operations engine (GRU_ENGINE=ops-crm). Parses a natural-language
 * order into a validated command, asks for confirmation through the gateway's
 * existing approval gate, then executes it against the creador_CRM API.
 *
 * SLICE 3: confirmation gate (simple SÍ/NO for non-money; double CONFIRMO for
 * money) + duplicate detection on invoice/sale + real execution of customer,
 * invoice and sale. Bookings remain DRY-RUN (name→ID resolution lands next).
 */

export interface OpsRunnerOptions {
  parser?: IntentParserOptions;
  crm?: {
    baseUrl?: string;
    serviceToken?: string;
    defaultBusinessId?: string;
    /** Duplicate-detection window in minutes (default 10). */
    duplicateWindowMin?: number;
  };
}

/**
 * Shape-compatible with the kernel's HumanApprovalRequiredError so the gateway's
 * intake gate (matched by `name`) drives single/double confirmation. A reason
 * matching /irreversible|destructiv/i makes intake require double-confirm.
 */
class OpsApprovalRequiredError extends Error {
  readonly name = "HumanApprovalRequiredError";
  constructor(
    readonly reasons: string[],
    readonly classification: { level: number; levelName: string },
  ) {
    super(`Confirmación requerida: ${reasons.join("; ")}`);
  }
}

export function createOpsRunner(options: OpsRunnerOptions = {}): OrchestrateFn {
  const parseIntent = createIntentParser(options.parser);
  const windowMin = options.crm?.duplicateWindowMin ?? 10;

  const crmReady = Boolean(options.crm?.baseUrl && options.crm?.serviceToken);
  const crm = crmReady
    ? new CrmClient({ baseUrl: options.crm!.baseUrl!, serviceToken: options.crm!.serviceToken! })
    : undefined;

  return async function orchestrateOps(prompt, _provider, opts): Promise<string> {
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
    const businessId =
      (opts as { businessId?: string } | undefined)?.businessId ?? options.crm?.defaultBusinessId;
    const approved = (opts as { approved?: boolean } | undefined)?.approved === true;

    // Booking is not executable yet (needs name→ID resolution) → dry-run.
    const executable = crm && (cmd.entity === "customer" || cmd.entity === "invoice" || cmd.entity === "sale");
    if (!executable) {
      const guard = isMoneyCommand(cmd) ? " [acción de dinero — requerirá doble confirmación]" : "";
      return `[DRY-RUN] ${preview}${guard}\n\n(Ejecución real de esta operación llega en una fase posterior.)`;
    }

    if (!businessId) {
      return "Falta seleccionar negocio. Configura DEFAULT_BUSINESS_ID (o usa /negocio en una fase posterior).";
    }

    // ── Confirmation gate (only on the first pass; the approved re-run skips it) ──
    if (!approved) {
      const reasons: string[] = [preview];
      if (isMoneyCommand(cmd)) {
        reasons.push("Acción de dinero IRREVERSIBLE.");
        // Duplicate detection for money entities.
        if (cmd.entity === "invoice" || cmd.entity === "sale") {
          const dup = await findRecentDuplicate(
            crm!,
            businessId,
            { entity: cmd.entity, cliente: getCliente(cmd), total: getTotal(cmd) },
            windowMin,
          );
          if (dup.found) reasons.push(`⚠️ Posible duplicado (creado hace ${dup.minutesAgo} min).`);
        }
      }
      const level = isMoneyCommand(cmd) ? 3 : 1;
      const levelName = isMoneyCommand(cmd) ? "Large" : "Small";
      throw new OpsApprovalRequiredError(reasons, { level, levelName });
    }

    // ── Approved: execute for real ──
    try {
      return await execute(crm!, businessId, cmd);
    } catch (err) {
      if (err instanceof CrmError) return `❌ ${err.message}`;
      return `❌ Error ejecutando la operación: ${err instanceof Error ? err.message : String(err)}`;
    }
  };
}

function getCliente(cmd: Command): string {
  if (cmd.entity === "invoice") return cmd.params.cliente;
  if (cmd.entity === "sale") return cmd.params.cliente;
  return "";
}
function getTotal(cmd: Command): number {
  if (cmd.entity === "invoice") return cmd.params.total;
  if (cmd.entity === "sale") return cmd.params.total;
  return 0;
}

async function execute(crm: CrmClient, businessId: string, cmd: Command): Promise<string> {
  switch (cmd.entity) {
    case "customer": {
      if (cmd.operation === "create") {
        const { nombre, telefono, email } = cmd.params;
        const row = await crm.createCustomer(businessId, { nombre, telefono, email });
        return `✅ Cliente dado de alta: ${nombre}${row?.id ? ` (id ${row.id})` : ""}`;
      }
      const all = await crm.listCustomers(businessId);
      const needle = cmd.params.nombre?.toLowerCase();
      const matches = needle ? all.filter((c) => c.nombre.toLowerCase().includes(needle)) : all;
      if (matches.length === 0) return "No encontré clientes con ese criterio.";
      return matches.slice(0, 20).map((c) => `• ${c.nombre}${c.telefono ? ` — ${c.telefono}` : ""}`).join("\n");
    }
    case "invoice": {
      const { cliente, servicio, total } = cmd.params;
      const row = await crm.createInvoice(businessId, { cliente, servicio, total });
      return `✅ Factura creada: ${row.numero} — ${cliente} — ${total}€`;
    }
    case "sale": {
      const { cliente, total } = cmd.params;
      await crm.createSale(businessId, { cliente, total });
      return `✅ Venta registrada: ${cliente} — ${total}€`;
    }
    default:
      return "Operación no soportada.";
  }
}
