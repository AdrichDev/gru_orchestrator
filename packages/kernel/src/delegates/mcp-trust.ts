/**
 * F-02 (auditoría integral) — confianza explícita para servidores MCP leídos del proyecto.
 *
 * Un `.mcp.json` es un fichero del repositorio: si `gru` ejecuta el `command` que contiene
 * sin más, un repo clonado (o cualquiera de sus carpetas padre) puede ejecutar código
 * arbitrario con los privilegios del usuario en cuanto se corre `gru status` o `gru delegate`.
 *
 * Reglas (las tres se aplican, no una):
 *   1. Solo el `.mcp.json` del PROYECTO (`GRU_PROJECT_ROOT` o cwd): nunca un padre.
 *   2. El fichero tiene que estar CONFIADO por su huella sha256 en
 *      `<gru-root>/trusted-mcp.json`. Si cambia un byte, deja de estar confiado.
 *   3. El comando tiene que ser de la allowlist y, si es un gestor de paquetes, llevar la
 *      versión fija del paquete (nada de `@latest` ni de paquete suelto).
 *
 * `gru trust-mcp` es lo único que añade una huella al almacén; el modelo no puede hacerlo.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { resolveGruRoot } from "../config/resolve.js";

export interface Context7Config {
  command: string;
  args: string[];
}

/** Binarios que se aceptan como lanzadores de un servidor MCP. */
export const MCP_COMMAND_ALLOWLIST: readonly string[] = ["npx", "node", "pnpm", "bunx", "context7-mcp"];

/** Paquete MCP que esperamos, siempre con versión fija. */
const PINNED_PACKAGE_RE = /^(?:--package=)?(?:@upstash\/context7-mcp|context7-mcp)@\d+\.\d+\.\d+(?:-[\w.]+)?$/;

export function mcpConfigFingerprint(content: string): string {
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

/** Ruta absoluta del proyecto cuyo `.mcp.json` puede leerse. */
export function mcpProjectRoot(): string {
  const override = process.env.GRU_PROJECT_ROOT;
  return override && override.trim() ? path.resolve(override) : process.cwd();
}

function trustStorePath(): string {
  // `GRU_MCP_TRUST_FILE` permite aislar el almacén en pruebas; en uso normal vive en el
  // gru-root del proyecto (`<root>/trusted-mcp.json`).
  const override = process.env.GRU_MCP_TRUST_FILE;
  if (override && override.trim()) return path.resolve(override);
  return path.join(resolveGruRoot(), "trusted-mcp.json");
}

function readTrustStore(): Record<string, string> {
  try {
    const raw = fs.readFileSync(trustStorePath(), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "string") out[key] = value;
      }
      return out;
    }
  } catch {
    // sin almacén o corrupto → nada confiado (fail-closed)
  }
  return {};
}

/**
 * Marca el `.mcp.json` indicado como confiado con su huella actual.
 * Lo llama `gru trust-mcp`; nunca el bucle del modelo.
 */
export function trustMcpConfig(file: string): string {
  const abs = path.resolve(file);
  const fingerprint = mcpConfigFingerprint(fs.readFileSync(abs, "utf-8"));
  const store = readTrustStore();
  store[abs] = fingerprint;
  const target = trustStorePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(store, null, 2) + "\n", "utf-8");
  return fingerprint;
}

/** true solo si el fichero está confiado Y su contenido actual coincide con la huella. */
export function isMcpConfigTrusted(file: string, content?: string): boolean {
  const abs = path.resolve(file);
  const expected = readTrustStore()[abs];
  if (!expected) return false;
  let current = content;
  if (current === undefined) {
    try {
      current = fs.readFileSync(abs, "utf-8");
    } catch {
      return false;
    }
  }
  return mcpConfigFingerprint(current) === expected;
}

export type CommandVerdict = { ok: true } | { ok: false; reason: string };

/** Allowlist de binario + versión fija del paquete MCP. */
export function assertMcpCommandAllowed(command: string, args: string[]): CommandVerdict {
  const bin = path.basename(command).replace(/\.(exe|cmd|bat)$/i, "");
  if (!MCP_COMMAND_ALLOWLIST.includes(bin)) {
    return {
      ok: false,
      reason: `comando "${command}" fuera de la allowlist (${MCP_COMMAND_ALLOWLIST.join(", ")})`,
    };
  }
  if (bin === "npx" || bin === "pnpm" || bin === "bunx") {
    const pinned = args.some((a) => PINNED_PACKAGE_RE.test(a));
    if (!pinned) {
      return {
        ok: false,
        reason:
          "el paquete MCP debe llevar versión fija (@upstash/context7-mcp@x.y.z); " +
          "sin versión o con @latest no se ejecuta",
      };
    }
  }
  return { ok: true };
}

export interface McpConfigReadResult {
  config: Context7Config | null;
  /** Motivo legible cuando `config` es null pero había un fichero. */
  blocked?: { kind: "untrusted" | "command"; reason: string; file: string };
}

/**
 * Lee el `.mcp.json` del proyecto aplicando las tres reglas.
 * No lanza: devuelve el motivo para que `detect()` lo muestre.
 */
/**
 * Lectura SIN decidir confianza: solo el `.mcp.json` del proyecto (nunca un padre). Existe para
 * poder probar la regla de ubicación por separado; el delegado usa `readTrustedContext7Config`.
 */
export function readProjectMcpContext7Config(): {
  file: string;
  raw: string;
  config: Context7Config | null;
} | null {
  const file = path.join(mcpProjectRoot(), ".mcp.json");
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf-8");
  } catch {
    return null;
  }
  let parsed: { mcpServers?: Record<string, { command?: unknown; args?: unknown }> };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { file, raw, config: null };
  }
  const server = parsed?.mcpServers?.context7;
  if (typeof server?.command !== "string" || !Array.isArray(server.args)) {
    return { file, raw, config: null };
  }
  const args = server.args.filter((a): a is string => typeof a === "string");
  return { file, raw, config: { command: server.command, args } };
}

export function readTrustedContext7Config(): McpConfigReadResult {
  const project = readProjectMcpContext7Config();
  if (!project) return { config: null };
  const { file, raw, config: parsedConfig } = project;
  if (!parsedConfig) return { config: null };
  const args = parsedConfig.args;
  const command = parsedConfig.command;
  const server = { command };

  if (!isMcpConfigTrusted(file, raw)) {
    return {
      config: null,
      blocked: {
        kind: "untrusted",
        reason: `.mcp.json no está confiado en este equipo: ${file}`,
        file,
      },
    };
  }

  const verdict = assertMcpCommandAllowed(server.command, args);
  if (!verdict.ok) {
    return { config: null, blocked: { kind: "command", reason: verdict.reason, file } };
  }

  return { config: { command: server.command, args } };
}
