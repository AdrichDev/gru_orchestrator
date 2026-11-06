/**
 * F-08 (auditoría integral) — modo de permisos del `claude` headless que arranca el gateway.
 *
 * Antes: el modo por defecto era `bypassPermissions` (autonomía total, sin ninguna
 * confirmación) y el parser de intenciones además lo fijaba a mano. Quien controla una de
 * las cuentas de Telegram/WhatsApp de la lista blanca controlaba la máquina: robar la
 * cuenta equivalía a ejecutar código arbitrario con los permisos del usuario.
 *
 * Ahora:
 *   - por defecto `acceptEdits` (puede editar ficheros del proyecto, pero no saltarse los
 *     controles de shell/red);
 *   - `bypassPermissions` SOLO si el operador lo pide de forma explícita y además confirma
 *     con `GRU_ALLOW_FULL_AUTONOMY=1` (dos llaves, como los lanzamientos nucleares);
 *   - un valor desconocido no se propaga: se cae al modo seguro y se avisa.
 */
export const SAFE_PERMISSION_MODE = "acceptEdits";

export const ALLOWED_PERMISSION_MODES: readonly string[] = [
  "default",
  "plan",
  "acceptEdits",
  "bypassPermissions",
];

export interface PermissionModeResolution {
  mode: string;
  /** Aviso para el log cuando se ha degradado o rechazado lo pedido. */
  warning?: string;
}

/**
 * Resuelve el modo a usar a partir de lo pedido y del interruptor de autonomía total.
 * Nunca devuelve `bypassPermissions` sin la confirmación explícita.
 */
export function resolvePermissionMode(
  requested?: string,
  fullAutonomyAck?: string,
): PermissionModeResolution {
  const raw = (requested ?? "").trim();
  if (!raw) return { mode: SAFE_PERMISSION_MODE };

  const match = ALLOWED_PERMISSION_MODES.find((m) => m.toLowerCase() === raw.toLowerCase());
  if (!match) {
    return {
      mode: SAFE_PERMISSION_MODE,
      warning: `CLAUDE_PERMISSION_MODE="${raw}" no es un modo conocido; se usa ${SAFE_PERMISSION_MODE}.`,
    };
  }

  if (match === "bypassPermissions" && (fullAutonomyAck ?? "").trim() !== "1") {
    return {
      mode: SAFE_PERMISSION_MODE,
      warning:
        "Se pidió bypassPermissions sin GRU_ALLOW_FULL_AUTONOMY=1: " +
        `se usa ${SAFE_PERMISSION_MODE}. Pon las dos variables si de verdad quieres autonomía total.`,
    };
  }

  return { mode: match };
}
