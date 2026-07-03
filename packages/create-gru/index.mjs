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
const IS_WIN = process.platform === "win32";

/**
 * SEC-02: nunca usar shell:true. Resolvemos la ruta real del binario con
 * where.exe/which y lanzamos spawnSync con array de argumentos, prefiriendo
 * el shim .cmd/.exe en Windows (mismo patrón que scripts/setup-providers.mjs).
 *
 * Gotcha Windows: where.exe SIEMPRE prefiere el shim .cmd/.bat (npm/pnpm/gru
 * instalados globalmente son shims .cmd), pero CreateProcess no puede
 * ejecutar un .cmd/.bat directamente sin pasar por cmd.exe. Con
 * shell:false eso falla con EINVAL.
 *
 * Solución: si el binario resuelto es .cmd/.bat, invocarlo vía
 * `cmd.exe /d /s /c "<bin> <args...>"` construyendo NOSOTROS la línea de
 * comando completa como un único string ya citado (cada argumento
 * individualmente entrecomillado si contiene espacios/comillas) y
 * envuelto en un par extra de comillas exteriores — es el requisito de
 * cmd.exe con /S (quita solo el primer y último carácter de comilla de
 * TODA la línea, no por-argumento). Además hace falta
 * `windowsVerbatimArguments: true`: sin ese flag, Node vuelve a
 * escapar/citar cada elemento del array de argumentos como si fuese un
 * argv normal, lo que corrompe la línea de comando ya citada que
 * cmd.exe espera recibir tal cual (verificado empíricamente: sin este
 * flag, rutas con espacios como "C:\Program Files\nodejs\npm.cmd"
 * fallan con "no se reconoce como un comando interno o externo").
 * No es concatenación de input no confiable: bin/args son valores ya
 * resueltos por where.exe o literales del propio CLI, y cada uno se
 * cita individualmente antes de unirse — no hay inyección de shell.
 */
function quoteForCmd(value) {
  return /[\s"]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

function spawnResolved(resolvedBin, args, opts) {
  if (IS_WIN && /\.(cmd|bat)$/i.test(resolvedBin)) {
    const commandLine = [quoteForCmd(resolvedBin), ...args.map(quoteForCmd)].join(" ");
    return spawnSync("cmd.exe", ["/d", "/s", "/c", `"${commandLine}"`], {
      ...opts,
      shell: false,
      windowsVerbatimArguments: true,
    });
  }
  return spawnSync(resolvedBin, args, { ...opts, shell: false });
}

function resolveCmd(cmd) {
  try {
    const lookup = IS_WIN ? "where.exe" : "which";
    const result = spawnSync(lookup, [cmd], { encoding: "utf8", timeout: 10_000, shell: false });
    if (result.status !== 0) return null;
    const lines = result.stdout.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return null;
    if (IS_WIN) {
      const preferred = lines.find((l) => /\.(cmd|exe|bat)$/i.test(l));
      return preferred ?? lines[0];
    }
    return lines[0];
  } catch {
    return null;
  }
}

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
    const pmPath = resolveCmd("pnpm");
    const pm = pmPath ? "pnpm" : "npm";
    const installBin = pmPath ?? resolveCmd("npm");
    const installArgs = pm === "pnpm" ? ["add", "-g", REPO] : ["install", "-g", REPO];
    const install = `${pm} ${installArgs.join(" ")}`;
    console.log(`Harness 'gru' no encontrado. Instalando con: ${install}\n`);

    if (!installBin) {
      console.error(`\nNo se encontró '${pm}' en el PATH. Instala el harness manualmente:\n  ${install}`);
      process.exit(1);
    }

    const r = spawnResolved(installBin, installArgs, { stdio: "inherit" });
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

  const gruArgs = ["init", ...passthrough];
  console.log(`Ejecutando: ${["gru", ...gruArgs].join(" ")}\n`);
  const gruBin = resolveCmd("gru");
  if (!gruBin) {
    console.error("\n'gru' no está en el PATH. Abre una terminal nueva y ejecuta:  gru init");
    process.exit(1);
  }
  const r = spawnResolved(gruBin, gruArgs, { stdio: "inherit" });
  process.exit(r.status ?? 0);
}

function commandExists(cmd) {
  return resolveCmd(cmd) !== null;
}
