import type { OrchestrateFn } from "./intake.js";
import { createIntentParser, type IntentParserOptions } from "./ops/intent.js";
import { CommandSchema, isMoneyCommand, type Command } from "./ops/schemas.js";
import { renderPreview } from "./ops/preview.js";
import { CrmClient, CrmError } from "./ops/crm-client.js";
import { findRecentDuplicate } from "./ops/dedup.js";
import { resolveBusinessId, resolveTenantId, ResolveError } from "./ops/resolve.js";

/**
 * Business-operations engine (GRU_ENGINE=ops-crm). Parses a natural-language
 * order into a validated command, resolves the target CRM by name, asks for
 * confirmation (mutations only), then executes against creador_CRM.
 *
 * SLICE 4: CRM-level ops (create/list CRMs, list tenants) + per-order business
 * selection by name (no hardcoded default). Read-only commands skip the gate.
 * Bookings remain DRY-RUN (slot/resource resolution pending).
 */

export interface OpsRunnerOptions {
  parser?: IntentParserOptions;
  crm?: {
    baseUrl?: string;
    /** Service-to-service token for the Operator Agent router (all CrmClient ops). */
    operatorToken?: string;
    /** Last-resort business when an order names none. */
    defaultBusinessId?: string;
    duplicateWindowMin?: number;
  };
}

class OpsApprovalRequiredError extends Error {
  readonly name = "HumanApprovalRequiredError";
  constructor(
    readonly reasons: string[],
    readonly classification: { level: number; levelName: string },
  ) {
    super(`Confirmación requerida: ${reasons.join("; ")}`);
  }
}

const READ_ONLY = new Set(["customer.query", "crm.list", "tenant.list"]);
const NEEDS_BUSINESS = new Set(["customer", "invoice", "sale", "booking"]);

export function createOpsRunner(options: OpsRunnerOptions = {}): OrchestrateFn {
  const parseIntent = createIntentParser(options.parser);
  const windowMin = options.crm?.duplicateWindowMin ?? 10;

  const crmReady = Boolean(options.crm?.baseUrl && options.crm?.operatorToken);
  const crm = crmReady
    ? new CrmClient({
        baseUrl: options.crm!.baseUrl!,
        operatorToken: options.crm!.operatorToken!,
      })
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

    if (!crm) {
      return `[DRY-RUN] ${renderPreview(cmd)}\n\n(CRM no configurado: define CRM_BASE_URL y OPERATOR_SERVICE_TOKEN.)`;
    }

    // Bookings are not executable yet.
    if (cmd.entity === "booking") {
      return `[DRY-RUN] ${renderPreview(cmd)}\n\n(Las reservas llegan en una fase posterior.)`;
    }

    const approved = (opts as { approved?: boolean } | undefined)?.approved === true;
    const key = `${cmd.entity}.${cmd.operation ?? ""}`;

    try {
      // Resolve the target business for data commands (by name, or fallback).
      let businessId: string | undefined;
      if (NEEDS_BUSINESS.has(cmd.entity)) {
        businessId = await resolveTargetBusiness(crm, cmd, options.crm?.defaultBusinessId,
          (opts as { businessId?: string } | undefined)?.businessId);
      }

      // Read-only commands execute immediately (no confirmation).
      if (READ_ONLY.has(key)) {
        return await execute(crm, cmd, businessId);
      }

      // Mutations: confirmation gate on the first pass.
      if (!approved) {
        const reasons: string[] = [renderPreview(cmd)];
        if (isMoneyCommand(cmd)) {
          reasons.push("Acción de dinero IRREVERSIBLE.");
          if ((cmd.entity === "invoice" || cmd.entity === "sale") && businessId) {
            const dup = await findRecentDuplicate(
              crm, businessId,
              { entity: cmd.entity, cliente: getCliente(cmd), total: getTotal(cmd) },
              windowMin,
            );
            if (dup.found) reasons.push(`⚠️ Posible duplicado (creado hace ${dup.minutesAgo} min).`);
          }
        }
        const money = isMoneyCommand(cmd);
        throw new OpsApprovalRequiredError(reasons, {
          level: money ? 3 : 1,
          levelName: money ? "Large" : "Small",
        });
      }

      // Approved → execute.
      return await execute(crm, cmd, businessId);
    } catch (err) {
      if (err instanceof OpsApprovalRequiredError) throw err; // let intake drive the gate
      if (err instanceof ResolveError) return `❓ ${err.message}`;
      if (err instanceof CrmError) return `❌ ${err.message}`;
      return `❌ Error ejecutando la operación: ${err instanceof Error ? err.message : String(err)}`;
    }
  };
}

async function resolveTargetBusiness(
  crm: CrmClient,
  cmd: Command,
  defaultBusinessId: string | undefined,
  sessionBusinessId: string | undefined,
): Promise<string> {
  const named = "params" in cmd && cmd.params && "negocio" in cmd.params ? (cmd.params as { negocio?: string }).negocio : undefined;
  if (named) return resolveBusinessId(crm, named);
  const fallback = sessionBusinessId ?? defaultBusinessId;
  if (fallback) return fallback;
  throw new ResolveError("¿En qué negocio? Dilo en la orden, ej: 'en JorjotasBarber, ...'.");
}

function getCliente(cmd: Command): string {
  if (cmd.entity === "invoice" || cmd.entity === "sale") return cmd.params.cliente;
  return "";
}
function getTotal(cmd: Command): number {
  if (cmd.entity === "invoice" || cmd.entity === "sale") return cmd.params.total;
  return 0;
}

async function execute(crm: CrmClient, cmd: Command, businessId?: string): Promise<string> {
  switch (cmd.entity) {
    case "customer": {
      if (cmd.operation === "create") {
        const { nombre, telefono, email } = cmd.params;
        const row = await crm.createCustomer(businessId!, { nombre, telefono, email });
        return `✅ Cliente dado de alta: ${nombre}${row?.id ? ` (id ${row.id})` : ""}`;
      }
      const all = await crm.listCustomers(businessId!);
      const needle = cmd.params.nombre?.toLowerCase();
      const matches = needle ? all.filter((c) => c.nombre.toLowerCase().includes(needle)) : all;
      if (matches.length === 0) return "No encontré clientes con ese criterio.";
      return matches.slice(0, 20).map((c) => `• ${c.nombre}${c.telefono ? ` — ${c.telefono}` : ""}`).join("\n");
    }
    case "invoice": {
      const { cliente, servicio, total } = cmd.params;
      const row = await crm.createInvoice(businessId!, { cliente, servicio, total });
      return `✅ Factura creada: ${row.numero} — ${cliente} — ${total}€`;
    }
    case "sale": {
      const { cliente, total } = cmd.params;
      await crm.createSale(businessId!, { cliente, total });
      return `✅ Venta registrada: ${cliente} — ${total}€`;
    }
    case "crm": {
      if (cmd.operation === "create") {
        const tenantId = await resolveTenantId(crm, cmd.params.tenant);
        const row = await crm.createProject({ tenantId, nombre: cmd.params.nombre, vertical: cmd.params.vertical });
        return `✅ CRM creado: ${cmd.params.nombre} (id ${row.id}) para el tenant ${cmd.params.tenant}`;
      }
      const tenantId = cmd.params?.tenant ? await resolveTenantId(crm, cmd.params.tenant).catch(() => undefined) : undefined;
      const list = await crm.listProjects(tenantId);
      if (list.length === 0) return "No hay CRMs.";
      return list.slice(0, 30).map((p) => `• ${p.business.nombre} (${p.business.vertical})`).join("\n");
    }
    case "tenant": {
      const list = await crm.listTenants();
      if (list.length === 0) return "No hay tenants.";
      return list.slice(0, 30).map((t) => `• ${t.nombre}`).join("\n");
    }
    default:
      return "Operación no soportada.";
  }
}
