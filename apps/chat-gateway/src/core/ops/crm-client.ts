/**
 * Minimal HTTP client for the creador_CRM API. Every method goes through the
 * Operator Agent router (/service/operator/*, requestOperator() below),
 * authenticated with OPERATOR_SERVICE_TOKEN (x-service-token) — NOT /api/*,
 * which requires a real Supabase user session (authenticate middleware) the
 * bot doesn't have (crm-operator-bot-write-ops).
 */

export interface CrmClientConfig {
  baseUrl: string; // e.g. http://localhost:4001/api
  /** Service-to-service token for the Operator Agent router (x-service-token). */
  operatorToken: string;
}

export class CrmError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "CrmError";
  }
}

export interface CustomerInput {
  nombre: string;
  telefono?: string;
  email?: string;
}

export class CrmClient {
  constructor(private readonly cfg: CrmClientConfig) {}

  /**
   * Calls the Operator Agent router (/service/operator/*), a separate auth
   * mechanism from request(): header `x-service-token` (not `Authorization:
   * Bearer`), no `x-business-id`. That router is mounted OUTSIDE /api in
   * creador_CRM (see server.ts: `app.use('/service/operator', ...)`), so it
   * does not hang off `baseUrl` the way every other route here does — baseUrl
   * already includes the `/api` suffix (e.g. http://localhost:4001/api), so we
   * strip it to get the API host and append `/service/operator` ourselves.
   *
   * Supports GET and POST (crm-operator-bot-write-ops): all 8 CrmClient
   * methods now go through here instead of request(), since /api/* requires a
   * real Supabase user session (authenticate middleware) that the bot doesn't
   * have. `businessId` (when relevant) travels as a query param on GET or in
   * the body on POST — the operator router has no `x-business-id` header.
   */
  private async requestOperator<T>(method: string, path: string, body?: unknown): Promise<T> {
    const operatorBase = this.cfg.baseUrl.replace(/\/api\/?$/, "");
    const headers: Record<string, string> = {
      "x-service-token": this.cfg.operatorToken,
      "Content-Type": "application/json",
    };

    let res: Response;
    try {
      res = await fetch(`${operatorBase}/service/operator${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new CrmError(
        `El CRM no respondió (${err instanceof Error ? err.message : String(err)}).`,
        0,
      );
    }

    if (!res.ok) {
      let detail = "";
      try {
        const j = (await res.json()) as { error?: { message?: string } };
        detail = j.error?.message ?? "";
      } catch {
        /* non-JSON body */
      }
      const friendly =
        res.status === 401
          ? "Token de operador inválido (revisa OPERATOR_SERVICE_TOKEN)."
          : res.status === 404
            ? `No encontrado${detail ? `: ${detail}` : ""}.`
            : res.status === 422
              ? `Datos inválidos${detail ? `: ${detail}` : ""}.`
              : `El CRM devolvió ${res.status}${detail ? `: ${detail}` : ""}.`;
      throw new CrmError(friendly, res.status);
    }

    return (await res.json()) as T;
  }

  async createCustomer(businessId: string, input: CustomerInput): Promise<{ id: string }> {
    return this.requestOperator("POST", "/customers", { businessId, ...input });
  }

  async listCustomers(businessId: string): Promise<Array<{ id: string; nombre: string; telefono?: string }>> {
    const { customers } = await this.requestOperator<{
      customers: Array<{ id: string; nombre: string; telefono?: string }>;
    }>("GET", `/customers?businessId=${encodeURIComponent(businessId)}`);
    return customers;
  }

  // numero is server-assigned by the operator route — never sent by the bot.
  async createInvoice(
    businessId: string,
    input: { cliente: string; servicio: string; total: number },
  ): Promise<{ id: string; numero: string }> {
    return this.requestOperator("POST", "/invoices", { businessId, ...input });
  }

  async listInvoices(
    businessId: string,
  ): Promise<Array<{ id: string; cliente: string; total: number; createdAt?: string }>> {
    const { invoices } = await this.requestOperator<{
      invoices: Array<{ id: string; cliente: string; total: number; createdAt?: string }>;
    }>("GET", `/invoices?businessId=${encodeURIComponent(businessId)}`);
    return invoices;
  }

  async createSale(businessId: string, input: { cliente: string; total: number }): Promise<{ id: string }> {
    return this.requestOperator("POST", "/sales", { businessId, ...input });
  }

  async listSales(
    businessId: string,
  ): Promise<Array<{ id: string; cliente?: string; total: number; createdAt?: string }>> {
    const { sales } = await this.requestOperator<{
      sales: Array<{ id: string; cliente?: string; total: number; createdAt?: string }>;
    }>("GET", `/sales?businessId=${encodeURIComponent(businessId)}`);
    return sales;
  }

  // ── CRM-level (cross-business) ops — no businessId at all ──

  /**
   * List real projects — CRMs (negocio) linked to an actual agents-agency
   * tenant. Backed by GET /service/operator/proyectos, NOT /api/projects:
   * the latter filters by the caller's Membership rows, which also surfaces
   * demo/seed/duplicate businesses that happen to have a membership (root
   * cause of the "listame los proyectos" bug — it returned far more than the
   * real count). The operator endpoint instead filters server-side by
   * `tenant_id IS NOT NULL AND eliminado_en IS NULL`, so it only returns
   * negocios genuinely tied to a real client.
   *
   * `tenantId` is kept for signature compatibility with existing callers
   * (ops-runner.ts, ops/resolve.ts) but is NOT used to filter: the operator
   * endpoint has no per-tenant filter (its WHERE is `tenant_id IS NOT NULL`,
   * not `tenant_id = X`). This is not a regression — /api/projects also
   * ignored this query param before (see projects.ts GET '/': it reads no
   * `req.query.tenantId` at all).
   */
  async listProjects(
    tenantId?: string,
  ): Promise<Array<{ id: string; business: { nombre: string; vertical: string } }>> {
    void tenantId; // not filterable server-side by the operator endpoint (see doc above).
    const { proyectos } = await this.requestOperator<{
      proyectos: Array<{ negocioId: string; nombre: string; vertical: string }>;
    }>("GET", "/proyectos");
    return proyectos.map((p) => ({
      id: p.negocioId,
      business: { nombre: p.nombre, vertical: p.vertical },
    }));
  }

  /** List active agents-agency tenants (to link when creating a CRM). */
  async listTenants(): Promise<Array<{ id: string; nombre: string }>> {
    const { tenants } = await this.requestOperator<{ tenants: Array<{ id: string; nombre: string }> }>(
      "GET",
      "/tenants",
    );
    return tenants;
  }

  /** Create a CRM (Business) linked to an existing tenant. */
  async createProject(input: {
    tenantId: string;
    nombre: string;
    vertical?: string;
  }): Promise<{ id: string }> {
    return this.requestOperator("POST", "/proyectos", {
      tenantId: input.tenantId,
      confirmado: true,
      config: { business: { name: input.nombre, vertical: input.vertical ?? "custom" } },
    });
  }
}
