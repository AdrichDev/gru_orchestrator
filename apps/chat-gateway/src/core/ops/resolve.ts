import type { CrmClient } from "./crm-client.js";

/**
 * Resolve a CRM (Business) or tenant by NAME to its id. Throws a user-facing
 * Spanish message on no-match or ambiguity so the bot can ask for clarification.
 */

export class ResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResolveError";
  }
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Match by exact (case-insensitive) name first, then unique substring. */
function pick<T extends { nombre: string }>(rows: T[], name: string, kind: string): T {
  const n = norm(name);
  const exact = rows.filter((r) => norm(r.nombre) === n);
  const pool = exact.length > 0 ? exact : rows.filter((r) => norm(r.nombre).includes(n));
  if (pool.length === 0) throw new ResolveError(`No encontré ${kind} "${name}".`);
  if (pool.length > 1) {
    const names = pool.slice(0, 8).map((r) => `• ${r.nombre}`).join("\n");
    throw new ResolveError(`Hay varios ${kind} que coinciden con "${name}":\n${names}\nSé más específico.`);
  }
  return pool[0]!;
}

export async function resolveBusinessId(crm: CrmClient, name: string): Promise<string> {
  const projects = await crm.listProjects();
  const rows = projects.map((p) => ({ id: p.id, nombre: p.business.nombre }));
  return pick(rows, name, "CRM/negocio").id;
}

export async function resolveTenantId(crm: CrmClient, name: string): Promise<string> {
  const tenants = await crm.listTenants();
  return pick(tenants, name, "tenant").id;
}
