# Acceptance Criteria: Claude Harness Adapter

## AC1 — Type compatibility

```typescript
import type { HarnessAdapter } from "@gru/shared";
import { ClaudeHarnessAdapter } from ".../harness-claude.js";
const adapter: HarnessAdapter = new ClaudeHarnessAdapter(); // compiles
```

## AC2 — Availability detection

```typescript
const ready = new ClaudeHarnessAdapter(() => "claude");
(await ready.checkAvailability()).status === "ready"

const notReady = new ClaudeHarnessAdapter(() => "standalone");
(await notReady.checkAvailability()).status === "unsupported"
(await notReady.checkAvailability()).reason?.includes("standalone") === true
```

## AC3 — Capability coverage

```typescript
const adapter = new ClaudeHarnessAdapter();
adapter.supports("file-tools") === true
adapter.supports("native-subagents") === true
adapter.supports("code-execution") === true
adapter.supports("web-search") === true
adapter.supports("streaming") === true
adapter.supports("memory") === false
adapter.supports("approval-flow") === false
```

## AC4 — Context

```typescript
const ctx = await adapter.getContext();
ctx.harness === "claude"
ctx.modelControl === "host-managed"
ctx.capabilities.includes("file-tools")
ctx.capabilities.includes("native-subagents")
```

## AC5 — Execute host-managed

```typescript
const available = new ClaudeHarnessAdapter(() => "claude");
const r = await available.execute({ id: "t1", prompt: "do something" });
r.success === true
r.execution.runtimeMode === "host-managed"
r.execution.adapter === "claude"

const unavailable = new ClaudeHarnessAdapter(() => "gemini");
const r2 = await unavailable.execute({ id: "t2", prompt: "do something" });
r2.success === false
r2.error?.code === "HARNESS_UNAVAILABLE"
r2.error?.recoverable === false
```

## AC6 — Tests reales

`pnpm test` verde. Si se elimina el if en `checkAvailability()`, test R1b falla con assertion error.
