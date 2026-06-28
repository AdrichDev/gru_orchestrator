import type { GatewayEnv } from "./env.js";
import type { ProjectRegistry } from "./projects.js";
import type { SessionStore } from "./sessions.js";
import { type SingleFlightQueue, withCwd } from "./queue.js";
import { traceChannelEvent } from "./engram-log.js";
import type { ChannelId, ChannelSender, InboundMessage } from "./channel.js";

export type { InboundMessage } from "./channel.js";

interface ActiveProject {
  name: string;
  path: string;
}

/**
 * The single seam into Gru. Mirrors the kernel's `orchestrateTask` signature.
 * Injected at the composition root so this adapter stays decoupled from the
 * kernel's provider graph (and so it is unit-testable without loading it).
 */
export type OrchestrateFn = (
  prompt: string,
  forcedProvider?: string,
  options?: { approved?: boolean },
) => Promise<string>;

// Gru's typed errors are matched by their `name` (the kernel sets `this.name`).
// This avoids importing the error *values* (which would pull the kernel graph)
// and is resilient to dual-package-instance issues.
interface ApprovalErrorShape {
  name: string;
  reasons: string[];
  classification: { level: number; levelName: string };
}
interface MessageErrorShape {
  name: string;
  message: string;
  installHint?: string;
}

// Reasons emitted by the kernel risk classifier that mark a destructive task.
const DESTRUCTIVE_HINT = /irreversible|destructiv/i;

/**
 * Chat -> Gru intake adapter (channel-agnostic).
 *
 * One instance per channel, each wired with its own sender and sessions but
 * sharing ONE SingleFlightQueue across all channels — orchestrateTask switches
 * the process CWD per project, so WhatsApp and Telegram tasks must never run
 * concurrently. Responsibility is deliberately thin: normalize a chat message
 * into a Gru directive, hand it to `orchestrate`, and translate Gru's typed
 * outcomes back into chat replies. ALL routing, risk classification and
 * escalation stay inside Gru — this class never decides any of that.
 */
export class GruIntakeAdapter {
  constructor(
    private readonly channel: ChannelId,
    private readonly env: GatewayEnv,
    private readonly projects: ProjectRegistry,
    private readonly sessions: SessionStore,
    private readonly sender: ChannelSender,
    private readonly queue: SingleFlightQueue,
    private readonly orchestrate: OrchestrateFn,
  ) {}

  async handle(msg: InboundMessage): Promise<void> {
    const text = msg.text.trim();
    const session = this.sessions.get(msg.from);

    // 1) A pending risk approval takes precedence over everything else.
    if (session.pending) {
      await this.handleApprovalReply(msg.from, text);
      return;
    }

    // 2) Slash commands (project switching / help).
    if (text.startsWith("/")) {
      await this.handleCommand(msg.from, text);
      return;
    }

    // 3) Anything else is a directive for the active project.
    await this.runDirective(msg.from, text);
  }

  private async handleCommand(from: string, text: string): Promise<void> {
    const [cmd, ...rest] = text.split(/\s+/);
    const session = this.sessions.get(from);

    switch (cmd.toLowerCase()) {
      case "/proyecto": {
        const name = rest.join(" ").trim();
        if (!name) {
          await this.sender.send(from, "Uso: /proyecto <NOMBRE>");
          return;
        }
        const entry = this.projects.get(name);
        if (!entry) {
          await this.sender.send(
            from,
            `Proyecto desconocido: ${name}\nDisponibles: ${this.projects
              .list()
              .map((p) => p.name)
              .join(", ")}`,
          );
          return;
        }
        session.activeProject = entry.name;
        await this.sender.send(from, `✅ Proyecto activo: ${entry.name}\n${entry.path}`);
        return;
      }
      case "/proyectos":
        await this.sender.send(
          from,
          "Proyectos:\n" + this.projects.list().map((p) => `• ${p.name}`).join("\n"),
        );
        return;
      case "/activo":
        await this.sender.send(
          from,
          session.activeProject
            ? `Proyecto activo: ${session.activeProject}`
            : "Sin proyecto activo. Usa /proyecto <NOMBRE>.",
        );
        return;
      case "/ayuda":
      default:
        await this.sender.send(from, HELP_TEXT);
        return;
    }
  }

  private resolveProject(from: string): ActiveProject | undefined {
    const session = this.sessions.get(from);
    const name = session.activeProject ?? this.env.defaultProject;
    if (!name) return undefined;
    const entry = this.projects.get(name);
    return entry ? { name: entry.name, path: entry.path } : undefined;
  }

  private async runDirective(from: string, prompt: string): Promise<void> {
    const project = this.resolveProject(from);
    if (!project) {
      await this.sender.send(from, "No hay proyecto activo. Usa /proyecto <NOMBRE> primero.");
      return;
    }

    // Two-shot model: ack now, final result later. Gru emits no intermediate
    // progress events, so there is no streaming between these two messages.
    await this.sender.send(from, `🤖 Gru recibió la directiva para ${project.name}. Procesando...`);
    this.trace(project.path, { type: "directive_received", from, prompt, project: project.name });

    await this.queue.enqueue(() =>
      withCwd(project.path, async () => {
        try {
          const output = await this.orchestrate(prompt, this.env.gruDefaultProvider);
          this.trace(project.path, { type: "directive_done", from, project: project.name });
          await this.sender.send(from, `✅ ${project.name} — completado:\n\n${output}`);
        } catch (err) {
          await this.handleOrchestrationError(from, project, prompt, err);
        }
      }),
    );
  }

  private async handleApprovalReply(from: string, text: string): Promise<void> {
    const session = this.sessions.get(from);
    const pending = session.pending!;
    const saidYes = /^s[ií]$/i.test(text) || /^confirmo$/i.test(text);
    const saidNo = /^no$/i.test(text);

    if (saidNo) {
      session.pending = undefined;
      await this.sender.send(from, "Cancelado. No se ejecutó nada.");
      this.trace(pending.projectPath, { type: "approval_cancelled", from });
      return;
    }
    if (!saidYes) {
      await this.sender.send(from, "Responde *SÍ* para continuar o *NO* para cancelar.");
      return;
    }

    // Double-confirm gate for destructive/irreversible tasks.
    if (pending.stage === "double" && !pending.confirmedOnce) {
      pending.confirmedOnce = true;
      await this.sender.send(
        from,
        "Confirmación 1/2 recibida. Esta acción es IRREVERSIBLE.\nResponde *CONFIRMO* para ejecutar definitivamente.",
      );
      return;
    }
    if (pending.stage === "double" && pending.confirmedOnce && !/^confirmo$/i.test(text)) {
      await this.sender.send(from, "Para acciones destructivas, escribe *CONFIRMO* exactamente.");
      return;
    }

    // Approved → re-run with explicit human approval.
    const { prompt, projectName, projectPath } = pending;
    session.pending = undefined;
    await this.sender.send(from, `▶️ Ejecutando en ${projectName} (aprobado)...`);
    this.trace(projectPath, { type: "approval_granted", from, project: projectName });

    await this.queue.enqueue(() =>
      withCwd(projectPath, async () => {
        try {
          const output = await this.orchestrate(prompt, this.env.gruDefaultProvider, { approved: true });
          this.trace(projectPath, { type: "approved_done", from, project: projectName });
          await this.sender.send(from, `✅ ${projectName} — completado:\n\n${output}`);
        } catch (err) {
          await this.handleOrchestrationError(from, { name: projectName, path: projectPath }, prompt, err);
        }
      }),
    );
  }

  private async handleOrchestrationError(
    from: string,
    project: ActiveProject,
    prompt: string,
    err: unknown,
  ): Promise<void> {
    const name = (err as { name?: string })?.name;

    // Risk gate: Gru blocked execution pending human approval. Map to the
    // "responde SÍ" confirmation flow (double-confirm if destructive).
    if (name === "HumanApprovalRequiredError") {
      const e = err as ApprovalErrorShape;
      const reasons = e.reasons ?? [];
      const destructive = reasons.some((r) => DESTRUCTIVE_HINT.test(r));
      this.sessions.get(from).pending = {
        prompt,
        reasons,
        level: e.classification.level,
        levelName: e.classification.levelName,
        stage: destructive ? "double" : "single",
        confirmedOnce: false,
        projectName: project.name,
        projectPath: project.path,
      };
      const ask = destructive
        ? "Esta tarea es DESTRUCTIVA/IRREVERSIBLE. Responde *SÍ* para continuar (pediré una segunda confirmación)."
        : "Responde *SÍ* para ejecutar, o *NO* para cancelar.";
      await this.sender.send(
        from,
        `⚠️ Riesgo nivel ${e.classification.level} — ${e.classification.levelName}.\nMotivos: ${reasons.join("; ")}\n\n${ask}`,
      );
      this.trace(project.path, {
        type: "approval_requested",
        from,
        reasons,
        level: e.classification.level,
      });
      return;
    }

    // No silent fallback: forward Gru's exact error to the user (per the spec).
    if (name === "ProviderUnavailableError") {
      const e = err as MessageErrorShape;
      await this.sender.send(
        from,
        `🚫 Provider no disponible: ${e.message}${e.installHint ? `\nSolución: ${e.installHint}` : ""}`,
      );
      return;
    }
    if (name === "DelegationBlockedError") {
      const e = err as MessageErrorShape;
      await this.sender.send(from, `🛑 Bloqueado por Devil's Advocate: ${e.message}`);
      return;
    }

    const message = err instanceof Error ? err.message : String(err);
    this.trace(project.path, { type: "directive_error", from, error: message });
    await this.sender.send(from, `❌ Error de Gru:\n${message}`);
  }

  private trace(projectPath: string, event: Record<string, unknown>): void {
    traceChannelEvent(this.channel, projectPath, event);
  }
}

const HELP_TEXT = `Gru — comandos:
/proyecto <NOMBRE> — fija el proyecto activo
/proyectos — lista proyectos
/activo — muestra proyecto activo
/ayuda — esta ayuda

Cualquier otro texto se envía a Gru como directiva sobre el proyecto activo.`;
