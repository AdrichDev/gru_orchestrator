import type {
  GruCapability,
  GruResult,
  GruTask,
  HarnessAdapter,
  HarnessAvailability,
  HarnessContext,
} from "../../../shared/src/ports/harness.js";
import { detectHarness } from "../../../shared/src/runtime/harness.js";

const CLAUDE_CAPABILITIES: GruCapability[] = [
  "file-tools",
  "native-subagents",
  "code-execution",
  "web-search",
];

export class ClaudeHarnessAdapter implements HarnessAdapter {
  readonly id = "claude" as const;

  constructor(
    private readonly _detect: () => string = detectHarness,
  ) {}

  async checkAvailability(): Promise<HarnessAvailability> {
    const harness = this._detect();
    return harness === "claude"
      ? { status: "ready" }
      : { status: "unsupported", reason: `Running in '${harness}' harness, not 'claude'.` };
  }

  supports(capability: GruCapability): boolean {
    return CLAUDE_CAPABILITIES.includes(capability);
  }

  async getContext(): Promise<HarnessContext> {
    return {
      harness: "claude",
      modelControl: "host-managed",
      capabilities: CLAUDE_CAPABILITIES,
    };
  }

  async execute(task: GruTask): Promise<GruResult> {
    const avail = await this.checkAvailability();
    if (avail.status !== "ready") {
      return {
        success: false,
        output: "",
        harness: "claude",
        execution: { adapter: "claude", runtimeMode: "host-managed" },
        error: {
          code: "HARNESS_UNAVAILABLE",
          message: avail.reason ?? "Claude harness not active",
          recoverable: false,
        },
      };
    }
    return {
      success: true,
      output: "[host-managed:dispatched]",
      harness: "claude",
      execution: { adapter: "claude", runtimeMode: "host-managed" },
    };
  }
}
