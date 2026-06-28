import type { Command } from "./schemas.js";

/**
 * Human-readable Spanish preview of a validated command, shown to the user before
 * execution (and, in later slices, fed to the confirmation gate). Pure function.
 */
export function renderPreview(cmd: Command): string {
  switch (cmd.entity) {
    case "customer":
      if (cmd.operation === "create") {
        const p = cmd.params;
        const extra = [p.telefono && `tel ${p.telefono}`, p.email && `email ${p.email}`]
          .filter(Boolean)
          .join(", ");
        return `Alta de cliente: ${p.nombre}${extra ? ` (${extra})` : ""}`;
      }
      return `Consulta de clientes${cmd.params.nombre ? `: ${cmd.params.nombre}` : ""}`;
    case "booking":
      return `Nueva reserva: ${cmd.params.clienteNombre} — ${cmd.params.servicioNombre} @ ${cmd.params.inicio}`;
    case "invoice":
      return `Nueva factura: ${cmd.params.cliente} — ${cmd.params.servicio} — ${cmd.params.total}€`;
    case "sale":
      return `Nueva venta: ${cmd.params.cliente} — ${cmd.params.total}€`;
    case "unknown":
    default:
      return "No entendí la operación. Reformula la orden (ej: 'da de alta al cliente Juan, tel 600...').";
  }
}
