import type {
  ProviderAvailability,
  ProviderId,
  RoutingDecision,
} from "../../../../shared/src/ports/provider.js";

export function applyDevilsAdvocate(output: string, prompt: string): string {
  return `${output}\n\n[CRÍTICA DE DEVIL'S ADVOCATE]\n- Riesgos detectados: Posible sobreacoplamiento con proveedores externos. Dependencia de variables no definidas en el prompt original: "${prompt}".\n- Edge cases: ¿Qué pasa si el proveedor seleccionado no responde o falla en tiempo de ejecución?\n- Restricciones de arquitectura: La separación actual asume ejecución secuencial simple, no soporta paralelización real ni workflows asíncronos distribuidos en esta versión.`;
}

// ─── Delegation review (pre-flight veto) ─────────────────────────────────────
// Devil reviews every delegation BEFORE the provider runs. It can block
// delegations that violate provider capabilities (e.g. using a catalog as an
// agent executor) or that target unavailable providers.

export interface DelegationReviewInput {
  prompt: string;
  providerId: ProviderId;
  decision: RoutingDecision;
  availability: ProviderAvailability;
}

export interface DelegationFinding {
  blocked: boolean;
  reason?: string;
  warnings: string[];
}

const EXECUTION_INTENT =
  /\b(ejecuta(r)?|corre(r)?|lanza(r)?|implementa(r)?|despliega|desplegar|run|execute|deploy|launch|spawn)\b/i;

export function reviewDelegation(input: DelegationReviewInput): DelegationFinding {
  const warnings: string[] = [];

  if (!input.availability.available) {
    return {
      blocked: true,
      reason: `Provider '${input.providerId}' no está disponible: ${input.availability.reason ?? "sin verificar"}. Gru no simula ejecuciones.`,
      warnings,
    };
  }

  // A catalog can search and read — it can NEVER act as an agent executor.
  if (input.availability.kind === "catalog" && EXECUTION_INTENT.test(input.prompt)) {
    return {
      blocked: true,
      reason: `Provider '${input.providerId}' es un catálogo de skills, no un executor. Buscar sí, ejecutar no.`,
      warnings,
    };
  }

  if (input.decision.confidence < 30) {
    warnings.push(
      `Confianza de routing baja (${input.decision.confidence}%). Considera confirmar el provider con el usuario.`,
    );
  }

  return { blocked: false, warnings };
}
