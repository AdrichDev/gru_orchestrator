import { orchestrateTask } from "../../../packages/kernel/src/orchestrator/index.js";
import { loadEnv } from "./env.js";
import { ProjectRegistry } from "./projects.js";
import { SessionStore } from "./sessions.js";
import { WhatsAppSender } from "./whatsapp.js";
import { GruIntakeAdapter, type OrchestrateFn } from "./intake.js";
import { createServer } from "./server.js";

function main(): void {
  const env = loadEnv();
  const projects = new ProjectRegistry(env.projectsFile);
  const sessions = new SessionStore();
  const wa = new WhatsAppSender(env);
  // Composition root: inject the real kernel intake. The signature matches
  // OrchestrateFn; the forcedProvider string is the kernel's ProviderId union.
  const orchestrate: OrchestrateFn = (prompt, provider, options) =>
    orchestrateTask(prompt, provider as Parameters<typeof orchestrateTask>[1], options);
  const adapter = new GruIntakeAdapter(env, projects, sessions, wa, orchestrate);
  const app = createServer(env, adapter);

  app.listen(env.port, () => {
    console.log(`\nGru WhatsApp gateway listening on :${env.port}`);
    console.log(`Webhook path:        ${env.webhookPath}`);
    console.log(`Whitelisted senders: ${env.adminNumbers.join(", ")}`);
    console.log(`Projects:            ${projects.list().map((p) => p.name).join(", ")}`);
    console.log(`Default project:     ${env.defaultProject ?? "(none — use /proyecto)"}`);
    console.log(`\nExpose this port with a tunnel, e.g.:`);
    console.log(`  cloudflared tunnel --url http://localhost:${env.port}`);
    console.log(`Then register the public URL with Kapso (see README).`);
  });
}

main();
