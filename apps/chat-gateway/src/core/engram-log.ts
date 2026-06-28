import fs from "node:fs";
import path from "node:path";
import type { ChannelId } from "./channel.js";

/**
 * Trace channel events for auditability.
 *
 * v1 writes a local JSONL audit trail under the active project's `.gru`
 * directory, tagging every event with its originating `channel`. Pushing these
 * into Engram (mem_save) is a Phase-2 seam — see README "Engram integration":
 * the kernel's EngramProvider is MCP-backed, so wiring a programmatic mem_save
 * here is intentionally deferred rather than faked.
 */
export function traceChannelEvent(
  channel: ChannelId,
  projectPath: string,
  event: Record<string, unknown>,
): void {
  try {
    const dir = path.join(projectPath, ".gru");
    fs.mkdirSync(dir, { recursive: true });
    const line =
      JSON.stringify({ ts: new Date().toISOString(), channel, ...event }) + "\n";
    fs.appendFileSync(path.join(dir, "chat-channel.log"), line, "utf-8");
  } catch (err) {
    console.warn("[trace] failed:", err instanceof Error ? err.message : String(err));
  }
}
