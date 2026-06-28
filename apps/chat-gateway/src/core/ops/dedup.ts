import type { CrmClient } from "./crm-client.js";

/**
 * Detect a near-identical recent invoice/sale (same business + same cliente +
 * same total) within a time window, so the bot can warn before creating a likely
 * duplicate. Best-effort: any CRM read failure is swallowed (returns not-found)
 * so dedup never blocks a legitimate action.
 */
export interface DuplicateHit {
  found: boolean;
  minutesAgo?: number;
}

function normName(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function withinWindow(createdAt: string | undefined, windowMin: number): number | undefined {
  if (!createdAt) return undefined;
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return undefined;
  const minutesAgo = (Date.now() - t) / 60_000;
  return minutesAgo >= 0 && minutesAgo <= windowMin ? Math.round(minutesAgo) : undefined;
}

export async function findRecentDuplicate(
  crm: CrmClient,
  businessId: string,
  args: { entity: "invoice" | "sale"; cliente: string; total: number },
  windowMin: number,
): Promise<DuplicateHit> {
  try {
    const rows =
      args.entity === "invoice"
        ? await crm.listInvoices(businessId)
        : await crm.listSales(businessId);
    const target = normName(args.cliente);
    for (const r of rows) {
      if (normName(r.cliente) !== target) continue;
      if (Number(r.total) !== Number(args.total)) continue;
      const minutesAgo = withinWindow(r.createdAt, windowMin);
      if (minutesAgo !== undefined) return { found: true, minutesAgo };
    }
  } catch {
    /* best-effort: ignore read errors */
  }
  return { found: false };
}
