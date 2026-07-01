import { spawn } from "node:child_process";
import os from "node:os";

/**
 * NL -> raw command parser, backed by the first-party `claude` CLI in headless
 * JSON mode (no paid Anthropic API — runs on the Claude plan). The parser runs
 * in a NEUTRAL cwd (os.tmpdir()) so it does NOT load any project CLAUDE.md /
 * Gru persona; it must behave as a pure, unbiased extractor.
 */

export interface RawIntent {
  entity: string;
  operation?: string;
  params?: Record<string, unknown>;
}

export interface IntentParserOptions {
  bin?: string; // default "claude"
  model?: string;
  timeoutMs?: number;
}

const SYSTEM = `Eres un PARSER. Conviertes el mensaje del usuario en UN objeto JSON valido y NADA mas (sin markdown, sin texto, sin explicacion).

Esquema de salida:
{"entity":"customer|booking|invoice|sale|crm|tenant|unknown","operation":"create|query|list","params":{...}}

Campos por comando (NO inventes campos que el usuario no haya dado):
- customer.create: { "nombre": string, "telefono"?: string, "email"?: string, "negocio"?: string }
- customer.query:  { "nombre"?: string, "negocio"?: string }
- booking.create:  { "clienteNombre": string, "servicioNombre": string, "inicio": string, "notas"?: string, "negocio"?: string }
- invoice.create:  { "cliente": string, "servicio": string, "total": number, "negocio"?: string }   // NUNCA incluyas "numero"
- sale.create:     { "cliente"?: string, "total": number, "negocio"?: string }
- crm.create:      { "tenant": string, "nombre": string, "vertical"?: string }   // crear un CRM/negocio nuevo enlazado a un tenant
- crm.list:        { "tenant"?: string }                                          // listar CRMs/negocios
- tenant.list:     {}                                                             // listar tenants de agents-agency

Conceptos:
- "negocio"/"CRM" = un Business de creador_CRM. "tenant" = cliente de agents-agency al que se enlaza un CRM.
- "negocio" en comandos de datos = sobre que CRM se opera (ej: "en JorjotasBarber, da de alta...").

Reglas:
- Si no encaja en ningun comando, devuelve {"entity":"unknown"}.
- "total" siempre numero (sin simbolo de moneda).
- Responde EXCLUSIVAMENTE el JSON.`;

function buildPrompt(message: string): string {
  return `${SYSTEM}\n\nMensaje del usuario: ${JSON.stringify(message)}\n\nJSON:`;
}

/** Reused from the claude-runner pattern: last balanced top-level {...}. */
function extractJson(text: string): unknown {
  const end = text.lastIndexOf("}");
  if (end === -1) return undefined;
  let depth = 0, inStr = false, esc = false;
  for (let i = end; i >= 0; i--) {
    const ch = text[i]!;
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "}") depth++;
    else if (ch === "{") {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(i, end + 1)); } catch { return undefined; }
      }
    }
  }
  return undefined;
}

export function createIntentParser(options: IntentParserOptions = {}) {
  const bin = options.bin?.trim() || "claude";
  const model = options.model?.trim() || "";
  const timeoutMs = options.timeoutMs ?? 90_000;

  return function parseIntent(message: string): Promise<RawIntent> {
    const args = ["-p", buildPrompt(message), "--output-format", "json", "--permission-mode", "bypassPermissions"];
    if (model) args.push("--model", model);

    return new Promise<RawIntent>((resolvePromise, reject) => {
      const child = spawn(bin, args, {
        cwd: os.tmpdir(), // neutral cwd: no project CLAUDE.md / Gru persona loaded
        shell: false,
        windowsHide: true,
        env: process.env,
      });
      let stdout = "", stderr = "", timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
      }, timeoutMs);

      child.stdout.on("data", (c: Buffer) => (stdout += c.toString("utf8")));
      child.stderr.on("data", (c: Buffer) => (stderr += c.toString("utf8")));
      child.on("error", (err) => { clearTimeout(timer); reject(new Error(`No se pudo ejecutar '${bin}': ${err.message}`)); });
      child.on("close", () => {
        clearTimeout(timer);
        if (timedOut) { reject(new Error("El parser de intención excedió el timeout.")); return; }
        // claude -p --output-format json wraps the answer in an envelope; the
        // model's JSON lives in `.result` (a string). Parse the envelope first.
        const envelope = extractJson(stdout) as { result?: string } | undefined;
        const inner = envelope?.result ?? stdout;
        const parsed = (typeof inner === "string" ? extractJson(inner) : inner) as RawIntent | undefined;
        if (!parsed || typeof parsed.entity !== "string") {
          reject(new Error(`No se pudo parsear la intención. Salida: ${(stderr || stdout).slice(0, 300)}`));
          return;
        }
        resolvePromise(parsed);
      });
    });
  };
}
