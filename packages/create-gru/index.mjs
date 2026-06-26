#!/usr/bin/env node
// create-gru — lanzador npx del harness Gru.
//
// NO copia archivos propios. Una sola vía de instalación: el CLI nativo
// `gru init`. Este paquete solo es una ENTRADA cómoda por npm/npx que:
//   1. instala el harness Gru nativo si falta (pnpm add -g github:…/gru_orchestrator),
//   2. ejecuta `gru init` reenviando tus flags.
//
//   pnpm dlx create-gru [init] [--scope project|global] [--runtime <list>]
//                              [--force] [--awesome-copilot]
//
// Así hay un único instalador (gru init, fuente canónica vía harness:gen) y
// cero contenido duplicado: no hay drift posible.

import { spawnSync } from "node:child_process";

const REPO = "github:AdrichDev/gru_orchestrator";

// Reenvía todo menos un "init"/"create-gru" inicial (siempre hacemos init).
const raw = process.argv.slice(2);
const DRY = raw.includes("--dry-run");
const cleaned = raw.filter((a) => a !== "--dry-run");
const passthrough = cleaned[0] === "init" || cleaned[0] === "create-gru" ? cleaned.slice(1) : cleaned;

main();

function main() {
  console.log("create-gru — lanzador del harness Gru\n");

  const gruPresent = commandExists("gru");

  if (DRY) {
    const pm = commandExists("pnpm") ? "pnpm" : "npm";
    const install = pm === "pnpm" ? `pnpm add -g ${REPO}` : `npm install -g ${REPO}`;
    console.log("[dry-run] Plan:");
    console.log(`  gru presente: ${gruPresent ? "sí (no se instala)" : `no → ${install}`}`);
    console.log(`  ejecutaría:   ${["gru", "init", ...passthrough].join(" ")}`);
    process.exit(0);
  }

  if (!gruPresent) {
    const pm = commandExists("pnpm") ? "pnpm" : "npm";
    const install = pm === "pnpm" ? `pnpm add -g ${REPO}` : `npm install -g ${REPO}`;
    console.log(`Harness 'gru' no encontrado. Instalando con: ${install}\n`);

    const r = spawnSync(install, { stdio: "inherit", shell: true });
    if (r.status !== 0) {
      console.error(`\nFalló la instalación del harness. Instálalo manualmente:\n  ${install}`);
      process.exit(r.status ?? 1);
    }

    if (!commandExists("gru")) {
      console.error(
        "\nHarness instalado, pero 'gru' aún no está en el PATH de esta sesión.\n" +
        "Abre una terminal nueva y ejecuta:  gru init"
      );
      process.exit(0);
    }
  }

  const cmd = ["gru", "init", ...passthrough].join(" ");
  console.log(`Ejecutando: ${cmd}\n`);
  const r = spawnSync(cmd, { stdio: "inherit", shell: true });
  process.exit(r.status ?? 0);
}

function commandExists(cmd) {
  const probe = process.platform === "win32" ? `where ${cmd}` : `command -v ${cmd}`;
  return spawnSync(probe, { stdio: "ignore", shell: true }).status === 0;
}
