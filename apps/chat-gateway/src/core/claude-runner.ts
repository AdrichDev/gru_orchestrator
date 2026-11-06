import { spawn } from "node:child_process";
import type { OrchestrateFn } from "./intake.js";
import { resolvePermissionMode } from "./permission-mode.js";

/**
 * Claude Code CLI engine for the chat gateway.
 *
 * Runs the directive through the FIRST-PARTY `claude` CLI in headless print mode
 * (`claude -p ... --output-format json`) with the active project as cwd. Claude
 * Code auto-loads the project's CLAUDE.md (the Gru persona), so a chat message is
 * executed exactly as if the admin had typed it into Claude Code here.
 *
 * Why this instead of the kernel's orchestrateTask: orchestrateTask routes to
 * third-party provider CLIs (gentle-pi/ecc), which Anthropic bills as
 * third-party "extra usage" rather than against the Claude plan. The `claude`
 * CLI is first-party and runs within the user's Claude Code plan.
 */

export interface ClaudeRunnerOptions {
  /** Command to invoke Claude Code. Default "claude" (must be on PATH). */
  bin?: string;
  /**
   * Permission mode for headless runs. Default `acceptEdits` (edits files, keeps the
   * shell/network gates). `bypassPermissions` requires BOTH the explicit mode and
   * `GRU_ALLOW_FULL_AUTONOMY=1`; see `permission-mode.ts` (hallazgo F-08).
   */
  permissionMode?: string;
  /** Optional model override (e.g. "claude-opus-4-8"). Empty => Claude default. */
  model?: string;
  /** Hard timeout (ms) for a single run. Default 30 min. */
  timeoutMs?: number;
}

/** Subset of the `claude -p --output-format json` result envelope we consume. */
interface ClaudeJsonResult {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  session_id?: string;
  total_cost_usd?: number;
}

/** `OrchestrateFn` más el modo resuelto, para diagnóstico y pruebas. */
export type ClaudeRunnerFn = OrchestrateFn & { permissionMode: string };

export function createClaudeRunner(options: ClaudeRunnerOptions = {}): ClaudeRunnerFn {
  const bin = options.bin?.trim() || "claude";
  // El modo NO se toma a ciegas de la opción: pasa por el resolutor, que exige dos llaves
  // para la autonomía total y degrada cualquier valor desconocido (F-08).
  const resolution = resolvePermissionMode(
    options.permissionMode ?? process.env.CLAUDE_PERMISSION_MODE,
    process.env.GRU_ALLOW_FULL_AUTONOMY,
  );
  const permissionMode = resolution.mode;
  if (resolution.warning) console.warn(`[chat-gateway] ${resolution.warning}`);
  const model = options.model?.trim() || "";
  const timeoutMs = options.timeoutMs ?? 30 * 60_000;

  const orchestrateViaClaude = function (prompt: string): Promise<string> {
    const args = [
      "-p",
      prompt,
      "--output-format",
      "json",
      "--permission-mode",
      permissionMode,
    ];
    if (model) args.push("--model", model);

    return new Promise<string>((resolvePromise, reject) => {
      // Inherit the per-directive cwd set by the queue (withCwd) so Claude loads
      // the right project's CLAUDE.md and operates on the right repo.
      const child = spawn(bin, args, {
        cwd: process.cwd(),
        shell: false, // verbatim argv: untrusted message text is never shell-parsed.
        windowsHide: true,
        env: process.env,
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
      }, timeoutMs);

      child.stdout.on("data", (c: Buffer) => (stdout += c.toString("utf8")));
      child.stderr.on("data", (c: Buffer) => (stderr += c.toString("utf8")));

      child.on("error", (err) => {
        clearTimeout(timer);
        reject(new Error(`No se pudo ejecutar '${bin}': ${err.message}`));
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        if (timedOut) {
          reject(new Error(`Claude Code excedió el timeout (${timeoutMs} ms).`));
          return;
        }

        const parsed = extractJson(stdout);
        if (parsed) {
          if (parsed.is_error) {
            reject(new Error(parsed.result || "Claude Code devolvió un error."));
            return;
          }
          resolvePromise(parsed.result ?? "(sin salida)");
          return;
        }

        // Unparseable output: surface raw stderr/stdout so the admin sees it.
        const raw = (stderr || stdout || "(sin salida)").trim();
        reject(new Error(`Claude Code exit ${code}, salida no parseable:\n${raw}`));
      });
    });
  };
  // Expuesto para pruebas y para el arranque del gateway (log/diagnóstico): deja ver qué
  // modo se resolvió sin tener que mirar la línea de comandos del proceso hijo.
  orchestrateViaClaude.permissionMode = permissionMode;
  return orchestrateViaClaude;
}

/**
 * Extract the last balanced top-level JSON object from stdout. `claude -p
 * --output-format json` prints one JSON document, but a trust/permission banner
 * may precede it, so scan for the final {...} block.
 */
function extractJson(stdout: string): ClaudeJsonResult | undefined {
  const end = stdout.lastIndexOf("}");
  if (end === -1) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = end; i >= 0; i--) {
    const ch = stdout[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "}") depth++;
    else if (ch === "{") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(stdout.slice(i, end + 1)) as ClaudeJsonResult;
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}
