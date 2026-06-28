import type { OrchestrateFn } from "./intake.js";
import { createIntentParser, type IntentParserOptions } from "./ops/intent.js";
import { CommandSchema, isMoneyCommand } from "./ops/schemas.js";
import { renderPreview } from "./ops/preview.js";

/**
 * Business-operations engine (GRU_ENGINE=ops-crm). Turns a natural-language
 * Telegram order into a structured, validated business command.
 *
 * SLICE 1 — DRY RUN: parse -> zod-validate -> render preview. It does NOT call
 * any product API yet, needs no service token, and writes nothing. This proves
 * the NL->command path in isolation. Later slices add: CRM HTTP client +
 * CRM_SERVICE_TOKEN, the confirmation gate (simple vs double for money),
 * duplicate detection, multi-tenant /negocio routing, and agents-agency.
 */

export interface OpsRunnerOptions {
  parser?: IntentParserOptions;
}

export function createOpsRunner(options: OpsRunnerOptions = {}): OrchestrateFn {
  const parseIntent = createIntentParser(options.parser);

  return async function orchestrateOps(prompt: string): Promise<string> {
    let raw;
    try {
      raw = await parseIntent(prompt);
    } catch (err) {
      return `No pude interpretar la orden: ${err instanceof Error ? err.message : String(err)}`;
    }

    const parsed = CommandSchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "?"}: ${i.message}`).join("; ");
      return `Datos incompletos o inválidos: ${issues}`;
    }

    const cmd = parsed.data;
    if (cmd.entity === "unknown") {
      return renderPreview(cmd);
    }

    const preview = renderPreview(cmd);
    const guard = isMoneyCommand(cmd) ? " [acción de dinero — requerirá doble confirmación]" : "";
    // DRY RUN marker: no execution happens in slice 1.
    return `[DRY-RUN] ${preview}${guard}\n\n(El motor de ejecución real se conecta en la siguiente fase.)`;
  };
}
