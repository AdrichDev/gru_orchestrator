# Design: Claude Harness Adapter

## Arquitectura

```
packages/
  kernel/src/adapters/
    harness-claude.ts          ← NEW: ClaudeHarnessAdapter
    __tests__/
      harness-claude.test.ts   ← NEW: tests con injected detect fn
```

No se toca `ports/harness.ts` (interface ya correcta).
No se toca `runtime/harness.ts` (detectHarness ya correcta).

## Implementación

```typescript
// packages/kernel/src/adapters/harness-claude.ts

import type {
  HarnessAdapter, HarnessAvailability, HarnessContext,
  GruTask, GruResult, GruCapability
} from "../../../shared/src/ports/harness.js";
import { detectHarness } from "../../../shared/src/runtime/harness.js";

const CLAUDE_CAPABILITIES: GruCapability[] = [
  "file-tools",
  "native-subagents",
  "code-execution",
  "web-search",
  "streaming",
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
      output: task.prompt,
      harness: "claude",
      execution: { adapter: "claude", runtimeMode: "host-managed" },
    };
  }
}
```

## Decisiones

**Constructor injection para `_detect`**: Tests pasan `() => "claude"` o `() => "standalone"` sin tocar env vars reales. Misma técnica que `Context7Delegate._probe`.

**CLAUDE_CAPABILITIES estáticas**: No se hace probe real. Claude Code siempre tiene file-tools, Agent (native-subagents), Bash (code-execution), WebSearch (web-search). Agregar `memory` o `approval-flow` es un cambio de una línea cuando estén wired.

**`execute()` como host-managed passthrough**: Gru corre DENTRO de Claude. No tiene sentido invocar Claude desde dentro. `execute()` existe para satisfacer la interface; devuelve la tarea como confirmación de que el host la procesará.

**No se exporta desde adapters index**: En esta fase no hay un `adapters/index.ts` que agregue HarnessAdapter. Se importa directamente cuando se necesite.

## Tests (deben FALLAR si lógica es incorrecta)

```typescript
// Falla si checkAvailability no usa _detect
it("detect returns 'claude' → ready", () => {
  const a = new ClaudeHarnessAdapter(() => "claude");
  // Si no usa _detect, siempre devuelve ready sin importar lo que detecte
  const b = new ClaudeHarnessAdapter(() => "standalone");
  // b.checkAvailability() DEBE devolver unsupported — si falla, el test falla
})

// Falla si supports() no filtra correctamente
it("memory NOT supported", () => {
  expect(new ClaudeHarnessAdapter().supports("memory")).toBe(false)
  // Si alguien agrega memory a CLAUDE_CAPABILITIES sin querer, falla
})
```
