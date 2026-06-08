export type HarnessId = "claude" | "codex" | "gemini" | "pi" | "standalone";

// Best-effort detection. Not authoritative until HarnessAdapter is implemented.
export function detectHarness(): HarnessId {
  if (process.env.CLAUDE_CODE_ENTRYPOINT) return "claude";
  if (process.env.CODEX_SANDBOX_NETWORK_DISABLED !== undefined) return "codex";
  if (process.env.PI_AGENT_ID) return "pi";
  if (process.env.GEMINI_CLI_SESSION) return "gemini";
  return "standalone";
}
