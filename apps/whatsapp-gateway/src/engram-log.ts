import fs from "node:fs";
import path from "node:path";

/**
 * Trace channel events for auditability.
 *
 * v1 writes a local JSONL audit trail under the active project's `.gru`
 * directory, tagging every event with `channel: "whatsapp"`. Pushing these into
 * Engram (mem_save) is a Phase-2 seam — see README "Engram integration": the
 * kernel's EngramProvider is an MCP-backed provider, so wiring a programmatic
 * mem_save here is intentionally deferred rather than faked.
 */
export function traceChannelEvent(projectPath: string, event: Record<string, unknown>): void {
  try {
    const dir = path.join(projectPath, ".gru");
    fs.mkdirSync(dir, { recursive: true });
    const line =
      JSON.stringify({ ts: new Date().toISOString(), channel: "whatsapp", ...event }) + "\n";
    fs.appendFileSync(path.join(dir, "whatsapp-channel.log"), line, "utf-8");
  } catch (err) {
    console.warn("[trace] failed:", err instanceof Error ? err.message : String(err));
  }
}
