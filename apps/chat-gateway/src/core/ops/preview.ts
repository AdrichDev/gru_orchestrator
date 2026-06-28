import type { Command } from "./schemas.js";

/**
 * Human-readable Spanish preview of a validated command, shown before execution
 * (and fed to the confirmation gate). Pure function.
 */
export function renderPreview(cmd: Command): string {
  switch (cmd.entity) {
    case "customer":
      if (cmd.operation === "create") {
        const p = cmd.params;
        const extra = [p.telefono && `tel ${p.telefono}`, p.email && `email ${p.email}`]
          .filter(Boolean)
          .join(", ");
        return `Alta de cliente: ${p.nombre}${extra ? ` (${extra})` : ""}${at(p.negocio)}`;
      }
      return `Consulta de clientes${cmd.params.nombre ? `: ${cmd.params.nombre}` : ""}${at(cmd.params.negocio)}`;
    case "booking":
      return `Nueva reserva: ${cmd.params.clienteNombre} — ${cmd.params.servicioNombre} @ ${cmd.params.inicio}${at(cmd.params.negocio)}`;
    case "invoice":
      return `Nueva factura: ${cmd.params.cliente} — ${cmd.params.servicio} — ${cmd.params.total}€${at(cmd.params.negocio)}`;
    case "sale":
      return `Nueva venta: ${cmd.params.cliente} — ${cmd.params.total}€${at(cmd.params.negocio)}`;
    case "crm":
      if (cmd.operation === "create") {
        return `Crear CRM "${cmd.params.nombre}" para el tenant ${cmd.params.tenant}${cmd.params.vertical ? ` (vertical ${cmd.params.vertical})` : ""}`;
      }
      return `Listar CRMs${cmd.params?.tenant ? ` del tenant ${cmd.params.tenant}` : ""}`;
    case "tenant":
      return "Listar tenants de agents-agency";
    case "unknown":
    default:
      return "No entendí la operación. Reformula la orden (ej: 'en JorjotasBarber, da de alta al cliente Juan, tel 600...').";
  }
}

function at(negocio?: string): string {
  return negocio ? ` [negocio: ${negocio}]` : "";
}
