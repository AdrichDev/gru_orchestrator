import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type {
  ProviderDelegate,
  ProviderDetection,
  ProviderExecutionRequest,
  ProviderExecutionResult,
  ProviderCapability,
  DelegationProviderId,
} from "../../../shared/src/ports/delegation.js";
import { capabilitiesFor } from "./capabilities.js";
import { assertOperation, makeInvocationId } from "./base.js";

export interface Context7Config {
  command: string;
  args: string[];
}

export function readContext7Config(): Context7Config | null {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const mcpPath = path.join(dir, ".mcp.json");
    if (fs.existsSync(mcpPath)) {
      try {
        const raw = fs.readFileSync(mcpPath, "utf-8");
        const config = JSON.parse(raw) as Record<string, unknown>;
        const servers = config?.mcpServers as Record<string, unknown> | undefined;
        const server = servers?.context7 as { command?: unknown; args?: unknown } | undefined;
        if (typeof server?.command === "string" && Array.isArray(server.args)) {
          return { command: server.command, args: server.args as string[] };
        }
      } catch {
        // malformed .mcp.json → skip
      }
      return null;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export async function probeContext7(config: Context7Config): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (ok: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { child.kill(); } catch { /* ignore */ }
      resolve(ok);
    };

    const child = spawn(config.command, config.args, { stdio: ["pipe", "pipe", "ignore"] });
    const timer = setTimeout(() => settle(false), 3000);

    let buf = "";
    child.stdout?.on("data", (d: Buffer) => {
      buf += d.toString();
      for (const line of buf.split("\n")) {
        const t = line.trim();
        if (!t) continue;
        try {
          const msg = JSON.parse(t) as Record<string, unknown>;
          if (msg.jsonrpc === "2.0" && msg.id === 1 && "result" in msg) {
            settle(true);
            return;
          }
        } catch { /* not yet a complete JSON line */ }
      }
    });

    child.on("error", () => settle(false));
    child.on("close", () => { if (!settled) settle(false); });

    const initMsg =
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "gru-probe", version: "1.0.0" },
        },
      }) + "\n";

    try {
      child.stdin?.write(initMsg);
    } catch {
      settle(false);
    }
  });
}

/**
 * Context7 delegate — documentation provider via MCP.
 *
 * detect() probes the real MCP server: AVAILABLE only when the server
 * responds to initialize. execute() never fabricates documentation.
 *
 * Dependencies are injected for testability; defaults use the real
 * filesystem reader and spawn-based probe.
 */
export class Context7Delegate implements ProviderDelegate {
  readonly id: DelegationProviderId = "context7";

  constructor(
    private readonly _readConfig: () => Context7Config | null = readContext7Config,
    private readonly _probe: (config: Context7Config) => Promise<boolean> = probeContext7,
  ) {}

  async detect(): Promise<ProviderDetection> {
    const config = this._readConfig();

    if (!config) {
      return {
        providerId: "context7",
        status: "UNAVAILABLE",
        integration: "PLANNED",
        reason: "Context7 not configured in .mcp.json.",
        installHint:
          'Add "context7" to mcpServers in .mcp.json: { "command": "npx", "args": ["-y", "--package=@upstash/context7-mcp", "--", "context7-mcp"] }',
      };
    }

    const alive = await this._probe(config);
    if (!alive) {
      return {
        providerId: "context7",
        status: "UNAVAILABLE",
        integration: "READY",
        kind: "mcp",
        reason: "Context7 is configured but the MCP server did not respond to the initialize probe.",
        installHint: `Run "${config.command} ${config.args.join(" ")}" manually to verify the package is installed.`,
      };
    }

    return {
      providerId: "context7",
      status: "AVAILABLE",
      integration: "READY",
      kind: "mcp",
    };
  }

  async getCapabilities(): Promise<ProviderCapability[]> {
    return capabilitiesFor("context7");
  }

  async execute(req: ProviderExecutionRequest): Promise<ProviderExecutionResult> {
    const guard = assertOperation("context7", req);
    if (guard) return guard;

    const detection = await this.detect();
    if (detection.status !== "AVAILABLE") {
      return {
        providerId: "context7",
        invocationId: makeInvocationId("context7"),
        status: "UNAVAILABLE",
        error: detection.reason ?? "Context7 MCP server not available.",
        metadata: { installHint: detection.installHint, operation: req.operation },
      };
    }

    // MCP tool calling is not yet wired. Server is reachable but tool invocation
    // is out of scope for this phase. Never fabricates documentation output.
    return {
      providerId: "context7",
      invocationId: makeInvocationId("context7"),
      status: "UNAVAILABLE",
      error: "Context7 MCP tool execution not wired — server is reachable but tool calling is not implemented yet.",
      metadata: { integration: "READY", operation: req.operation },
    };
  }
}
