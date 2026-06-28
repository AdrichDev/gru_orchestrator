import { z } from "zod";

/**
 * Structured business commands the ops engine understands. The NL parser emits a
 * raw {entity, operation, params}; these zod schemas validate and narrow it
 * BEFORE anything is executed. Fields mirror the creador_CRM API.
 *
 * Slice 1 is DRY-RUN: parse -> validate -> preview only. No CRM calls yet, so
 * name->ID resolution (bookings) and money guardrails come in later slices.
 */

const customerCreate = z.object({
  entity: z.literal("customer"),
  operation: z.literal("create"),
  params: z.object({
    nombre: z.string().min(1, "nombre requerido"),
    telefono: z.string().optional(),
    email: z.string().email("email inválido").optional(),
  }),
});

const customerQuery = z.object({
  entity: z.literal("customer"),
  operation: z.literal("query"),
  params: z.object({ nombre: z.string().optional() }),
});

const bookingCreate = z.object({
  entity: z.literal("booking"),
  operation: z.literal("create"),
  // cliente/servicio by name — resolved to IDs in a later slice.
  params: z.object({
    clienteNombre: z.string().min(1, "cliente requerido"),
    servicioNombre: z.string().min(1, "servicio requerido"),
    inicio: z.string().min(1, "fecha/hora de inicio requerida"),
    notas: z.string().optional(),
  }),
});

const invoiceCreate = z.object({
  entity: z.literal("invoice"),
  operation: z.literal("create"),
  // NOTE: the bot NEVER sends `numero` — the CRM auto-numbers per business.
  // cliente/servicio are denormalized strings in the CRM, not FKs.
  params: z.object({
    cliente: z.string().min(1, "cliente requerido"),
    servicio: z.string().min(1, "servicio requerido"),
    total: z.number().positive("total debe ser > 0"),
  }),
});

const saleCreate = z.object({
  entity: z.literal("sale"),
  operation: z.literal("create"),
  params: z.object({
    cliente: z.string().min(1).default("Contado"),
    total: z.number().positive("total debe ser > 0"),
  }),
});

const unknown = z.object({
  entity: z.literal("unknown"),
  operation: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Union of every supported command. A plain union (not discriminatedUnion)
 * because two members share the `entity:"customer"` discriminator (create+query)
 * which zod's discriminatedUnion forbids.
 */
export const CommandSchema = z.union([
  customerCreate,
  customerQuery,
  bookingCreate,
  invoiceCreate,
  saleCreate,
  unknown,
]);

export type Command = z.infer<typeof CommandSchema>;

/** Entities whose create is money-affecting → require strong guardrails later. */
export const MONEY_ENTITIES = new Set(["invoice", "sale"]);

export function isMoneyCommand(cmd: Command): boolean {
  return MONEY_ENTITIES.has(cmd.entity) && cmd.operation === "create";
}
