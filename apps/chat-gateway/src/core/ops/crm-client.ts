/**
 * Minimal HTTP client for the creador_CRM API, authenticated with the
 * machine-to-machine CRM_SERVICE_TOKEN and scoped per business via x-business-id.
 *
 * Slice 2 covers customer create + query. Bookings/invoices/sales land in later
 * slices alongside name->ID resolution and the confirmation/dedup guardrails.
 */

export interface CrmClientConfig {
  baseUrl: string; // e.g. http://localhost:4001/api
  serviceToken: string;
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

  private async request<T>(
    method: string,
    path: string,
    businessId: string,
    body?: unknown,
  ): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.cfg.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.cfg.serviceToken}`,
          "x-business-id": businessId,
          "Content-Type": "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new CrmError(
        `El CRM no respondió (${err instanceof Error ? err.message : String(err)}).`,
        0,
      );
    }

    if (!res.ok) {
      // Map the CRM's error envelope to a user-facing message.
      let detail = "";
      try {
        const j = (await res.json()) as { error?: { message?: string } };
        detail = j.error?.message ?? "";
      } catch {
        /* non-JSON body */
      }
      const friendly =
        res.status === 401
          ? "Token de servicio inválido (revisa CRM_SERVICE_TOKEN)."
          : res.status === 400
            ? `Petición inválida${detail ? `: ${detail}` : ""}.`
            : res.status === 403
              ? "Operación no permitida para el bot."
              : res.status === 422
                ? `Datos inválidos${detail ? `: ${detail}` : ""}.`
                : res.status === 404
                  ? "No encontrado."
                  : `El CRM devolvió ${res.status}${detail ? `: ${detail}` : ""}.`;
      throw new CrmError(friendly, res.status);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  createCustomer(businessId: string, input: CustomerInput): Promise<{ id: string }> {
    return this.request("POST", "/customers", businessId, input);
  }

  listCustomers(businessId: string): Promise<Array<{ id: string; nombre: string; telefono?: string }>> {
    return this.request("GET", "/customers", businessId);
  }
}
