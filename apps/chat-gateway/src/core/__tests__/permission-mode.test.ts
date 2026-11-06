/**
 * F-08 — el gateway no puede regalar autonomía total por defecto, y `bypassPermissions`
 * exige dos llaves (modo pedido + GRU_ALLOW_FULL_AUTONOMY=1).
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  SAFE_PERMISSION_MODE,
  resolvePermissionMode,
} from "../permission-mode.js";
import { createClaudeRunner } from "../claude-runner.js";

const originalMode = process.env.CLAUDE_PERMISSION_MODE;
const originalAck = process.env.GRU_ALLOW_FULL_AUTONOMY;
afterEach(() => {
  if (originalMode === undefined) delete process.env.CLAUDE_PERMISSION_MODE;
  else process.env.CLAUDE_PERMISSION_MODE = originalMode;
  if (originalAck === undefined) delete process.env.GRU_ALLOW_FULL_AUTONOMY;
  else process.env.GRU_ALLOW_FULL_AUTONOMY = originalAck;
});

describe("resolvePermissionMode", () => {
  it("sin configurar nada NO da autonomía total", () => {
    const r = resolvePermissionMode(undefined, undefined);
    expect(r.mode).toBe(SAFE_PERMISSION_MODE);
    expect(r.mode).not.toBe("bypassPermissions");
  });

  it("un valor vacío tampoco", () => {
    expect(resolvePermissionMode("   ", "1").mode).toBe(SAFE_PERMISSION_MODE);
  });

  it("bypassPermissions sin la confirmación explícita se degrada y avisa", () => {
    const r = resolvePermissionMode("bypassPermissions", undefined);
    expect(r.mode).toBe(SAFE_PERMISSION_MODE);
    expect(r.warning).toMatch(/GRU_ALLOW_FULL_AUTONOMY/);
  });

  it("bypassPermissions con confirmación explícita sí se respeta", () => {
    expect(resolvePermissionMode("bypassPermissions", "1").mode).toBe("bypassPermissions");
  });

  it("un modo inventado no se propaga al CLI: cae al seguro y avisa", () => {
    const r = resolvePermissionMode("--dangerously-skip-permissions", "1");
    expect(r.mode).toBe(SAFE_PERMISSION_MODE);
    expect(r.warning).toMatch(/no es un modo conocido/);
  });

  it("los modos intermedios se respetan tal cual", () => {
    expect(resolvePermissionMode("plan").mode).toBe("plan");
    expect(resolvePermissionMode("acceptEdits").mode).toBe("acceptEdits");
    expect(resolvePermissionMode("default").mode).toBe("default");
  });

  it("acepta el nombre con otra capitalización sin cambiar de modo", () => {
    expect(resolvePermissionMode("BYPASSPERMISSIONS", "1").mode).toBe("bypassPermissions");
  });
});

describe("createClaudeRunner usa el modo resuelto", () => {
  it("por defecto pasa el modo seguro al CLI", async () => {
    delete process.env.CLAUDE_PERMISSION_MODE;
    process.env.GRU_ALLOW_FULL_AUTONOMY = "1";
    const run = createClaudeRunner({ bin: process.execPath });
    // Sin un `claude` real no podemos ejecutar: comprobamos el modo resuelto que usa.
    expect(run.permissionMode).toBe(SAFE_PERMISSION_MODE);
  });

  it("con las dos llaves usa bypassPermissions", () => {
    process.env.CLAUDE_PERMISSION_MODE = "bypassPermissions";
    process.env.GRU_ALLOW_FULL_AUTONOMY = "1";
    expect(createClaudeRunner({}).permissionMode).toBe("bypassPermissions");
  });

  it("con una sola llave se queda en el modo seguro", () => {
    process.env.CLAUDE_PERMISSION_MODE = "bypassPermissions";
    delete process.env.GRU_ALLOW_FULL_AUTONOMY;
    expect(createClaudeRunner({}).permissionMode).toBe(SAFE_PERMISSION_MODE);
  });
});
