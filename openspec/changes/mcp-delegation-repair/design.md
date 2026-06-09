# Design: MCP Delegation Repair

## Arquitectura

```
packages/kernel/src/
  ├── delegates/
  │     ├── context7.ts            ← MODIFIED: probe real via spawn + JSON-RPC
  │     ├── index.ts               ← MODIFIED: export resolveDelegate()
  │     └── __tests__/
  │           └── delegates.test.ts ← MODIFIED: nuevos tests Context7
  │
  ├── orchestrator/
  │     ├── index.ts               ← MODIFIED: orchestrateAgenticTask + operation param
  │     └── __tests__/
  │           └── config.test.ts   ← NEW: tests R1 + R2
  │
  └── (sin cambios en adapters/, gates/, shared/)
```

## Diseño de Context7Delegate (R3)

### Inyección de dependencias

```typescript
type ConfigReader = () => Context7Config | null;
type ProbeFunction = (config: Context7Config) => Promise<boolean>;

export class Context7Delegate implements ProviderDelegate {
  constructor(
    private readonly _readConfig: ConfigReader = readContext7Config,
    private readonly _probe: ProbeFunction = probeContext7,
  ) {}
```

- `readContext7Config()`: lee `.mcp.json` desde CWD hacia arriba (máx 4 niveles). Extrae `mcpServers.context7.{command, args}`.
- `probeContext7(config)`: spawns el proceso, envía `initialize` JSON-RPC, espera `result` con timeout de 3 segundos. Mata el proceso después del probe.

### Probe protocol

```
stdin  → {"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}\n
stdout ← {"jsonrpc":"2.0","id":1,"result":{...}}   → available=true
         timeout / error / close                    → available=false
```

Patrón de búsqueda en stdout: `jsonrpc === "2.0" && msg.id === 1 && "result" in msg`.

### Estados posibles de detect()

| .mcp.json tiene context7 | Probe responde | status    | integration |
|--------------------------|----------------|-----------|-------------|
| No                       | —              | UNAVAILABLE | PLANNED   |
| Sí                       | No (timeout)   | UNAVAILABLE | READY     |
| Sí                       | Sí             | AVAILABLE   | READY     |

### execute() honesto

Siempre llama `assertOperation()` primero (UNSUPPORTED si op no está en allowlist).
Si pasa, llama `detect()`. Si no AVAILABLE → devuelve UNAVAILABLE sin fabricar output.
Si AVAILABLE → invoca los tools MCP reales (futura implementación; actualmente devuelve UNAVAILABLE con razón "not wired").

## Diseño de resolveDelegate (R4)

### Función pública en delegates/index.ts

```typescript
export interface DelegationResolved {
  blocked: false;
  delegate: ProviderDelegate;
  delegateId: DelegationProviderId;
}

export interface DelegationBlocked {
  blocked: true;
  reason: string;
  installHint?: string;
}

export async function resolveDelegate(
  operation: string,
  registry?: DefaultDelegationRegistry,
): Promise<DelegationResolved | DelegationBlocked>
```

Algoritmo:
1. Obtiene `available = await registry.getAvailable()` (solo delegates con `detect() → AVAILABLE`).
2. Para cada delegate disponible: obtiene `getCapabilities()`, busca si `operation` está en el allowlist.
3. Primer match → devuelve `{ blocked: false, delegate, delegateId }`.
4. Sin match → `{ blocked: true, reason: "No available provider supports operation '${operation}'.", installHint: "..." }`.

No hay fallback silencioso. No hay "try ruflo anyway".

## Diseño de orchestrateAgenticTask (R4)

### Firma ampliada

```typescript
export async function orchestrateAgenticTask(
  prompt: string,
  phase: SddPhase = "apply",
  sddId = "current",
  operation?: string,   // NEW
): Promise<PlanResult>
```

### Flujo con operation

```
operation provided?
  ├── No  → existing ruflo agentic pipeline (unchanged)
  └── Yes → createDelegationRegistry()
             → resolveDelegate(operation, registry)
             ├── BLOCKED → return early PlanResult { approved: false, blockers: ["delegation:BLOCKED..."] }
             └── delegate.id === "ruflo" → fall through to existing pipeline
             └── delegate.id !== "ruflo" → delegate.execute(ProviderExecutionRequest)
                   ├── COMPLETED → PlanResult { approved: true }
                   └── other     → PlanResult { approved: false, blockers: ["<id>:<status> — <error>"] }
```

### backward compat

Sin `operation`: `createDelegationRegistry()` NO se invoca. El pipeline existente no cambia.

## Tests de configuración (R1 + R2)

`packages/kernel/src/orchestrator/__tests__/config.test.ts`

Leen ficheros reales del repo (no mocks). Son tests de contrato — si la config cambia incorrectamente, fallan.

```typescript
// R1: .mcp.json
const mcp = JSON.parse(fs.readFileSync(".mcp.json", "utf-8"));
const cf = mcp.mcpServers["claude-flow"];
expect(cf.command).toBe("pnpm");
expect(cf.args[0]).toBe("dlx");
expect(cf.args.join(" ")).toContain("ruflo");
expect(cf.command).not.toBe("npx");

// R2: settings.json
const settings = JSON.parse(fs.readFileSync(".claude/settings.json", "utf-8"));
const wildcardRules = settings.permissions.allow.filter((r: string) => /mcp__.*:\*$/.test(r));
expect(wildcardRules).toHaveLength(0);
```

## Invariantes preservadas

- `Context7Delegate.execute()` nunca devuelve `output` cuando `status !== "COMPLETED"`.
- `resolveDelegate()` nunca devuelve `blocked: false` con un delegate cuyo `detect()` sea `UNAVAILABLE`.
- `orchestrateAgenticTask()` sin `operation` tiene comportamiento 100% idéntico al actual.
- No se añaden fallbacks silenciosos en ningún path.
