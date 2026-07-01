import { z } from "zod";

/**
 * Structured business commands the ops engine understands. The NL parser emits a
 * raw {entity, operation, params}; these zod schemas validate and narrow it
 * BEFORE anything is executed. Fields mirror the creador_CRM API.
 *
 * Data commands carry an optional `negocio` (the CRM/Business name) so an order
 * can name its target ("en JorjotasBarber, alta cliente X"); the runner resolves
 * the name to a businessId. CRM-level commands (crm/tenant) operate across
 * businesses.
 */

const customerCreate = z.object({
  entity: z.literal("customer"),
  operation: z.literal("create"),
  params: z.object({
    nombre: z.string().min(1, "nombre requerido"),
    telefono: z.string().optional(),
    email: z.string().email("email inválido").optional(),
    negocio: z.string().optional(),
  }),
});

const customerQuery = z.object({
  entity: z.literal("customer"),
  operation: z.literal("query"),
  params: z.object({ nombre: z.string().optional(), negocio: z.string().optional() }),
});

const bookingCreate = z.object({
  entity: z.literal("booking"),
  operation: z.literal("create"),
  params: z.object({
    clienteNombre: z.string().min(1, "cliente requerido"),
    servicioNombre: z.string().min(1, "servicio requerido"),
    inicio: z.string().min(1, "fecha/hora de inicio requerida"),
    notas: z.string().optional(),
    negocio: z.string().optional(),
  }),
});

const invoiceCreate = z.object({
  entity: z.literal("invoice"),
  operation: z.literal("create"),
  // NOTE: the bot NEVER sends `numero` — the CRM auto-numbers per business.
  params: z.object({
    cliente: z.string().min(1, "cliente requerido"),
    servicio: z.string().min(1, "servicio requerido"),
    total: z.number().positive("total debe ser > 0"),
    negocio: z.string().optional(),
  }),
});

const saleCreate = z.object({
  entity: z.literal("sale"),
  operation: z.literal("create"),
  params: z.object({
    cliente: z.string().min(1).default("Contado"),
    total: z.number().positive("total debe ser > 0"),
    negocio: z.string().optional(),
  }),
});

// ── CRM-level (cross-business) ──
const crmCreate = z.object({
  entity: z.literal("crm"),
  operation: z.literal("create"),
  // A CRM is always linked to an existing agents-agency tenant (by name).
  params: z.object({
    tenant: z.string().min(1, "tenant requerido"),
    nombre: z.string().min(1, "nombre del CRM requerido"),
    vertical: z.string().optional(),
  }),
});

const crmList = z.object({
  entity: z.literal("crm"),
  operation: z.literal("list"),
  params: z.object({ tenant: z.string().optional() }).optional(),
});

const tenantList = z.object({
  entity: z.literal("tenant"),
  operation: z.literal("list"),
  params: z.object({}).optional(),
});

const unknown = z.object({
  entity: z.literal("unknown"),
  operation: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});

/** Union of every supported command (plain union: customer has 2 operations). */
export const CommandSchema = z.union([
  customerCreate,
  customerQuery,
  bookingCreate,
  invoiceCreate,
  saleCreate,
  crmCreate,
  crmList,
  tenantList,
  unknown,
]);

export type Command = z.infer<typeof CommandSchema>;

/** Entities whose create is money-affecting → require strong guardrails. */
export const MONEY_ENTITIES = new Set(["invoice", "sale"]);

export function isMoneyCommand(cmd: Command): boolean {
  return MONEY_ENTITIES.has(cmd.entity) && cmd.operation === "create";
}
