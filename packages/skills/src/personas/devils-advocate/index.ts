import type {
  ProviderAvailability,
  ProviderId,
  RoutingDecision,
} from "../../../../shared/src/ports/provider.js";
import type { DevilRigidity } from "../../../../shared/src/types/config.js";

export function applyDevilsAdvocate(output: string, prompt: string): string {
  return `${output}\n\n[CRÍTICA DE DEVIL'S ADVOCATE]\n- Riesgos detectados: Posible sobreacoplamiento con proveedores externos. Dependencia de variables no definidas en el prompt original: "${prompt}".\n- Edge cases: ¿Qué pasa si el proveedor seleccionado no responde o falla en tiempo de ejecución?\n- Restricciones de arquitectura: La separación actual asume ejecución secuencial simple, no soporta paralelización real ni workflows asíncronos distribuidos en esta versión.`;
}

// ─── Delegation review (pre-flight veto) ─────────────────────────────────────
// Devil reviews every delegation BEFORE the provider runs. It can block
// delegations that violate provider capabilities (e.g. using a catalog as an
// agent executor) or that target unavailable providers.
//
// HARD rules (always enforced, regardless of rigidity level):
//   1. Provider unavailable → blocked.
//   2. Catalog-kind provider with execution intent → blocked.
//
// SOFT rule (confidence check, governed by rigidity level):
//   "advisory"  → never emits a confidence warning; never blocks on confidence.
//   "strict"    → warn when confidence < minConfidence (default 30); never block.
//   "paranoid"  → warn when confidence < max(minConfidence, 60);
//                  block when confidence < minConfidence.

export interface DelegationReviewInput {
  prompt: string;
  providerId: ProviderId;
  decision: RoutingDecision;
  availability: ProviderAvailability;
  /**
   * Devil rigidity level. Governs the soft confidence check only.
   * Hard rules (unavailable, catalog-as-executor) always block regardless of level.
   * Default: "strict" — reproduces the original behavior when absent.
   */
  rigidity?: DevilRigidity;
  /**
   * Minimum confidence percentage threshold for the soft check.
   * Default: 30
   */
  minConfidence?: number;
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

  // ── HARD rule 1: provider unavailable (always blocks) ─────────────────────
  if (!input.availability.available) {
    return {
      blocked: true,
      reason: `Provider '${input.providerId}' no está disponible: ${input.availability.reason ?? "sin verificar"}. Gru no simula ejecuciones.`,
      warnings,
    };
  }

  // ── HARD rule 2: catalog used with execution intent (always blocks) ────────
  // A catalog can search and read — it can NEVER act as an agent executor.
  if (input.availability.kind === "catalog" && EXECUTION_INTENT.test(input.prompt)) {
    return {
      blocked: true,
      reason: `Provider '${input.providerId}' es un catálogo de skills, no un executor. Buscar sí, ejecutar no.`,
      warnings,
    };
  }

  // ── SOFT rule: confidence check (governed by rigidity level) ──────────────
  const rigidity: DevilRigidity = input.rigidity ?? "strict";
  const minConf: number = input.minConfidence ?? 30;
  const conf = input.decision.confidence;

  if (rigidity === "advisory") {
    // Never warn, never block on confidence — pass through.
  } else if (rigidity === "strict") {
    // Warn when below minConfidence; never block.
    if (conf < minConf) {
      warnings.push(
        `Confianza de routing baja (${conf}%). Considera confirmar el provider con el usuario.`,
      );
    }
  } else {
    // rigidity === "paranoid"
    // Block when confidence < minConfidence; warn when confidence < paranoidWarnThreshold.
    const paranoidWarnThreshold = Math.max(minConf, 60);
    if (conf < minConf) {
      return {
        blocked: true,
        reason: `Confianza de routing muy baja (${conf}%, mínimo configurado: ${minConf}%). Confirma el provider explícitamente antes de ejecutar.`,
        warnings,
      };
    }
    if (conf < paranoidWarnThreshold) {
      warnings.push(
        `Confianza de routing moderada (${conf}%). En modo paranoid, verifica que '${input.providerId}' es el provider correcto.`,
      );
    }
  }

  return { blocked: false, warnings };
}
