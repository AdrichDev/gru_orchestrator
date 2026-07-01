import { orchestrateTask } from "../../../packages/kernel/src/orchestrator/index.js";
import { loadEnv } from "./core/env.js";
import { ProjectRegistry } from "./core/projects.js";
import { SessionStore } from "./core/sessions.js";
import { SingleFlightQueue } from "./core/queue.js";
import { GruIntakeAdapter, type OrchestrateFn } from "./core/intake.js";
import { createClaudeRunner } from "./core/claude-runner.js";
import { createOpsRunner } from "./core/ops-runner.js";
import { WhatsAppSender } from "./channels/whatsapp/sender.js";
import { createWhatsAppServer } from "./channels/whatsapp/server.js";
import { TelegramSender } from "./channels/telegram/sender.js";
import { TelegramIngress } from "./channels/telegram/ingress.js";

function main(): void {
  const env = loadEnv();
  const engine = (process.env.GRU_ENGINE ?? "claude-cli").toLowerCase();
  const opsMode = engine === "ops-crm";
  const projects = new ProjectRegistry({
    projectsFile: env.projectsFile,
    roots: env.projectRoots,
    allowEmpty: opsMode, // ops bot targets businesses, not repos
  });

  // ONE queue shared across every channel. orchestrateTask switches the process
  // CWD per project, so tasks from different channels must never run concurrently.
  const queue = new SingleFlightQueue();

  // Composition root: pick the execution engine.
  //  - "claude-cli" (default): run each directive through the first-party
  //    `claude` CLI (headless), which loads the project's CLAUDE.md (Gru persona)
  //    and runs within the user's Claude plan — no third-party "extra usage".
  //  - "kernel": the standalone kernel orchestrateTask (routes to third-party
  //    provider CLIs). Opt in with GRU_ENGINE=kernel.
  //  - "ops-crm": business-operations engine — parses NL into structured CRM
  //    commands and executes them against creador_CRM. Opt in with GRU_ENGINE=ops-crm.
  let orchestrate: OrchestrateFn;
  if (engine === "kernel") {
    orchestrate = (prompt, provider, options) =>
      orchestrateTask(prompt, provider as Parameters<typeof orchestrateTask>[1], options);
  } else if (engine === "ops-crm") {
    orchestrate = createOpsRunner({
      parser: { bin: process.env.CLAUDE_BIN, model: process.env.CLAUDE_MODEL },
      crm: {
        baseUrl: process.env.CRM_BASE_URL,
        serviceToken: process.env.CRM_SERVICE_TOKEN,
        defaultBusinessId: process.env.DEFAULT_BUSINESS_ID,
        duplicateWindowMin: process.env.DUPLICATE_WINDOW_MINUTES
          ? Number(process.env.DUPLICATE_WINDOW_MINUTES)
          : undefined,
      },
    });
  } else {
    orchestrate = createClaudeRunner({
      bin: process.env.CLAUDE_BIN,
      permissionMode: process.env.CLAUDE_PERMISSION_MODE,
      model: process.env.CLAUDE_MODEL,
    });
  }

  const engineLabel =
    engine === "kernel"
      ? "kernel (orchestrateTask)"
      : engine === "ops-crm"
        ? "ops-crm (business ops, DRY-RUN)"
        : "claude-cli (headless)";

  console.log(`\nGru chat gateway — channels: ${env.channels.join(", ")}`);
  console.log(`Engine:          ${engineLabel}`);
  console.log(`Projects:        ${projects.list().map((p) => p.name).join(", ")}`);
  console.log(`Default project: ${env.defaultProject ?? "(none — use /proyecto)"}`);

  if (env.whatsapp) {
    const wa = env.whatsapp;
    const adapter = new GruIntakeAdapter(
      "whatsapp",
      env,
      projects,
      new SessionStore(),
      new WhatsAppSender(wa),
      queue,
      orchestrate,
      opsMode,
    );
    const app = createWhatsAppServer(wa, adapter);
    app.listen(wa.port, () => {
      console.log(`\n[whatsapp] listening on http://localhost:${wa.port}${wa.webhookPath}`);
      console.log(`[whatsapp] whitelist: ${wa.adminNumbers.join(", ")}`);
      console.log(`[whatsapp] expose with: cloudflared tunnel --url http://localhost:${wa.port}`);
      console.log(`[whatsapp] then register the public URL with Kapso (see README).`);
    });
  }

  if (env.telegram) {
    const tg = env.telegram;
    const tgSender = new TelegramSender(tg.botToken);
    const adapter = new GruIntakeAdapter(
      "telegram",
      env,
      projects,
      new SessionStore(),
      tgSender,
      queue,
      orchestrate,
    );
    new TelegramIngress(tg, adapter, tgSender).start();
    console.log(`\n[telegram] long-polling started (no tunnel needed)`);
    console.log(`[telegram] whitelist user ids: ${tg.adminIds.join(", ")}`);
  }
}

main();
