import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GruIntakeAdapter, type OrchestrateFn, type InboundMessage } from "../intake.js";
import { SessionStore } from "../sessions.js";
import { SingleFlightQueue } from "../queue.js";
import type { GatewayEnv } from "../env.js";
import type { ProjectRegistry, ProjectEntry } from "../projects.js";
import type { ChannelSender } from "../channel.js";

const FROM = "34600111222";

let projectDir: string;
let sent: string[];

function fakeSender(): ChannelSender {
  return {
    send: async (_to: string, body: string) => {
      sent.push(body);
    },
  };
}

function fakeProjects(): ProjectRegistry {
  const entry: ProjectEntry = { name: "TEST", path: projectDir };
  return {
    get: (name: string) => (name.toUpperCase() === "TEST" ? entry : undefined),
    list: () => [entry],
  } as unknown as ProjectRegistry;
}

function fakeEnv(): GatewayEnv {
  return { defaultProject: "TEST", gruDefaultProvider: undefined } as unknown as GatewayEnv;
}

function approvalError(reasons: string[], level = 3, levelName = "Large") {
  return Object.assign(new Error("approval required"), {
    name: "HumanApprovalRequiredError",
    reasons,
    classification: { level, levelName },
  });
}

function build(orchestrate: OrchestrateFn) {
  return new GruIntakeAdapter(
    "whatsapp",
    fakeEnv(),
    fakeProjects(),
    new SessionStore(),
    fakeSender(),
    new SingleFlightQueue(),
    orchestrate,
  );
}

function msg(text: string): InboundMessage {
  return { from: FROM, text, id: "m1" };
}

beforeEach(() => {
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "gw-intake-"));
  sent = [];
});

afterEach(() => {
  fs.rmSync(projectDir, { recursive: true, force: true });
});

describe("GruIntakeAdapter — directive happy path", () => {
  it("sends only the result (no ack chatter)", async () => {
    const adapter = build(async () => "RESULTADO");
    await adapter.handle(msg("haz algo"));
    expect(sent[sent.length - 1]).toContain("RESULTADO");
    // Quiet replies: no "directive received" ack is sent to the chat.
    expect(sent.some((m) => m.includes("recibió la directiva"))).toBe(false);
  });
});

describe("GruIntakeAdapter — confirm before run", () => {
  function buildConfirm(orchestrate: OrchestrateFn) {
    const env = { defaultProject: "TEST", gruDefaultProvider: undefined, confirmBeforeRun: true } as unknown as GatewayEnv;
    return new GruIntakeAdapter(
      "whatsapp",
      env,
      fakeProjects(),
      new SessionStore(),
      fakeSender(),
      new SingleFlightQueue(),
      orchestrate,
    );
  }

  it("asks for SÍ before running, then runs once confirmed", async () => {
    let calls = 0;
    const adapter = buildConfirm(async () => {
      calls++;
      return "EJECUTADO";
    });

    await adapter.handle(msg("haz algo"));
    expect(calls).toBe(0); // gated — nothing runs yet
    expect(sent.some((m) => m.includes("Vas a ejecutar"))).toBe(true);

    await adapter.handle(msg("SÍ"));
    expect(calls).toBe(1);
    expect(sent[sent.length - 1]).toContain("EJECUTADO");
  });

  it("does not run when the user replies NO", async () => {
    let calls = 0;
    const adapter = buildConfirm(async () => {
      calls++;
      return "EJECUTADO";
    });

    await adapter.handle(msg("haz algo"));
    await adapter.handle(msg("NO"));
    expect(calls).toBe(0);
    expect(sent[sent.length - 1]).toContain("Cancelado");
  });
});

describe("GruIntakeAdapter — risk approval (single)", () => {
  it("asks for SÍ, then runs with approved:true", async () => {
    let calls = 0;
    const seen: Array<{ approved?: boolean }> = [];
    const orchestrate: OrchestrateFn = async (_p, _prov, opts) => {
      calls++;
      seen.push(opts ?? {});
      if (calls === 1) throw approvalError(["toca seguridad o auth"]);
      return "EJECUTADO";
    };
    const adapter = build(orchestrate);

    await adapter.handle(msg("cambia el login"));
    expect(sent.some((m) => m.includes("Riesgo nivel 3"))).toBe(true);
    expect(sent.some((m) => m.includes("Responde *SÍ*"))).toBe(true);

    await adapter.handle(msg("SÍ"));
    expect(seen[1]).toEqual({ approved: true });
    expect(sent[sent.length - 1]).toContain("EJECUTADO");
  });

  it("cancels on NO without re-running", async () => {
    let calls = 0;
    const orchestrate: OrchestrateFn = async () => {
      calls++;
      if (calls === 1) throw approvalError(["toca seguridad o auth"]);
      return "SHOULD NOT RUN";
    };
    const adapter = build(orchestrate);
    await adapter.handle(msg("cambia el login"));
    await adapter.handle(msg("NO"));
    expect(calls).toBe(1);
    expect(sent[sent.length - 1]).toContain("Cancelado");
  });
});

describe("GruIntakeAdapter — destructive double-confirm", () => {
  it("requires SÍ then CONFIRMO before executing", async () => {
    let calls = 0;
    const orchestrate: OrchestrateFn = async () => {
      calls++;
      if (calls === 1) throw approvalError(["acción irreversible/destructiva"], 4, "Critical");
      return "BORRADO";
    };
    const adapter = build(orchestrate);

    await adapter.handle(msg("borra la base de datos"));
    expect(sent.some((m) => m.includes("DESTRUCTIVA/IRREVERSIBLE"))).toBe(true);

    await adapter.handle(msg("SÍ"));
    expect(sent[sent.length - 1]).toContain("Confirmación 1/2");
    expect(calls).toBe(1); // not executed yet

    await adapter.handle(msg("CONFIRMO"));
    expect(calls).toBe(2);
    expect(sent[sent.length - 1]).toContain("BORRADO");
  });
});

describe("GruIntakeAdapter — provider error forwarding", () => {
  it("forwards a ProviderUnavailableError verbatim", async () => {
    const orchestrate: OrchestrateFn = async () => {
      throw Object.assign(new Error("Provider 'ruflo' no disponible: x"), {
        name: "ProviderUnavailableError",
        message: "Provider 'ruflo' no disponible: x",
        installHint: "instala ruflo",
      });
    };
    const adapter = build(orchestrate);
    await adapter.handle(msg("haz algo"));
    const last = sent[sent.length - 1];
    expect(last).toContain("Provider no disponible");
    expect(last).toContain("instala ruflo");
  });
});

describe("GruIntakeAdapter — commands", () => {
  it("/proyectos lists projects without calling Gru", async () => {
    let calls = 0;
    const adapter = build(async () => {
      calls++;
      return "x";
    });
    await adapter.handle(msg("/proyectos"));
    expect(calls).toBe(0);
    expect(sent[0]).toContain("TEST");
  });
});
