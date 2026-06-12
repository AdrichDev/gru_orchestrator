#!/usr/bin/env node
/**
 * Gru Orchestrator — provider bootstrap.
 *
 * Verifies every provider declared in STRICT_PROVIDER_RUNTIME.md and installs
 * the missing ones. Cross-platform (Windows / macOS / Linux). Uses pnpm when
 * available, falls back to npm.
 *
 * Usage:
 *   node scripts/setup-providers.mjs            # interactive: asks before each install
 *   node scripts/setup-providers.mjs --check    # report only, installs nothing (exit 2 if missing)
 *   node scripts/setup-providers.mjs --yes      # installs everything without asking
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const CHECK_ONLY = process.argv.includes("--check");
const AUTO_YES = process.argv.includes("--yes");
const IS_WIN = process.platform === "win32";

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    shell: IS_WIN, // resolve .cmd/.bat shims on Windows
    timeout: opts.timeout ?? 120_000,
    stdio: opts.inherit ? "inherit" : "pipe",
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
    status: result.status,
  };
}

function has(cmd, args = ["--version"]) {
  const r = run(cmd, args, { timeout: 30_000 });
  return r.ok ? r.stdout.split(/\r?\n/)[0] : null;
}

const pkgManager = has("pnpm") ? "pnpm" : "npm";

async function confirm(question) {
  if (AUTO_YES) return true;
  if (!process.stdin.isTTY) return false;
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(`${question} (si/NO): `);
    return /^s[ií]$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

/**
 * Each provider: { id, detect(): string|null, install(): {ok, hint} | null }
 * install() === null means manual action required (we only print the hint).
 */
const PROVIDERS = [
  {
    id: "pnpm (gestor de paquetes)",
    detect: () => has("pnpm"),
    install: () => {
      // corepack ships with Node >= 16.13
      const corepack = run("corepack", ["enable"]);
      if (corepack.ok) {
        run("corepack", ["prepare", "pnpm@latest", "--activate"]);
        return { ok: !!has("pnpm") };
      }
      return { ok: run("npm", ["install", "-g", "pnpm"], { inherit: true }).ok };
    },
    hint: "corepack enable && corepack prepare pnpm@latest --activate  (o: npm install -g pnpm)",
  },
  {
    id: "pi (runtime de Gentle-Pi)",
    detect: () => has("pi"),
    install: () => ({ ok: run("npm", ["install", "-g", "pi"], { inherit: true }).ok }),
    hint: "npm install -g pi",
  },
  {
    id: "gentlePi (SDD/OpenSpec)",
    detect: () => (has("pi") && run("pi", ["list"]).stdout.includes("gentle-pi") ? "instalado vía pi" : null),
    install: () => {
      if (!has("pi")) return { ok: false };
      return { ok: run("pi", ["install", "npm:gentle-pi"], { inherit: true }).ok };
    },
    hint: "pi install npm:gentle-pi  (requiere pi)",
  },
  {
    id: "gentlemanCli (gentle-ai)",
    detect: () => has("gentle-ai"),
    install: () => {
      if (IS_WIN) return null; // install.sh is bash-only — manual on Windows
      return {
        ok: run("bash", ["-c", "curl -fsSL https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/scripts/install.sh | bash"], { inherit: true, timeout: 300_000 }).ok,
      };
    },
    hint: IS_WIN
      ? "Windows: instala gentle-ai manualmente (WSL o el instalador del repo Gentleman-Programming/gentle-ai)"
      : "curl -fsSL https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/scripts/install.sh | bash",
  },
  {
    id: "engram (memoria persistente)",
    detect: () => has("engram") ?? (process.env.ENGRAM_BIN && existsSync(process.env.ENGRAM_BIN) ? process.env.ENGRAM_BIN : null),
    install: () => {
      if (!has("pi")) return { ok: false };
      return { ok: run("pi", ["install", "npm:gentle-engram"], { inherit: true }).ok };
    },
    hint: "pi install npm:gentle-engram  (o define ENGRAM_BIN apuntando al binario)",
  },
  {
    id: "ruflo (orquestador multi-agente)",
    detect: () => {
      const r = run(pkgManager, pkgManager === "pnpm" ? ["dlx", "ruflo@latest", "--version"] : ["exec", "--yes", "ruflo@latest", "--version"], { timeout: 180_000 });
      return r.ok ? r.stdout.split(/\r?\n/)[0] : null;
    },
    install: () => ({
      ok: run(pkgManager, pkgManager === "pnpm" ? ["dlx", "ruflo@latest", "init", "wizard"] : ["exec", "--yes", "ruflo@latest", "init", "wizard"], { inherit: true, timeout: 600_000 }).ok,
    }),
    hint: "pnpm dlx ruflo@latest init wizard",
  },
  {
    id: "ecc (auditoría y seguridad)",
    detect: () => {
      const r = run(pkgManager, pkgManager === "pnpm" ? ["--package=ecc-universal", "dlx", "ecc", "--help"] : ["exec", "--yes", "--package=ecc-universal", "ecc", "--help"], { timeout: 180_000 });
      return r.ok ? "disponible vía dlx" : null;
    },
    install: () => ({ ok: run(pkgManager, ["add", "-D", "ecc-universal"], { inherit: true, timeout: 300_000 }).ok }),
    hint: "pnpm add -D ecc-universal",
  },
  {
    id: "awesomeCopilot (catálogo de skills)",
    detect: () => {
      const root = process.env.GRU_AWESOME_COPILOT_PATH ?? path.resolve("vendor", "awesome-copilot");
      return existsSync(path.join(root, "skills")) ? root : null;
    },
    install: () => {
      if (!has("git")) return { ok: false };
      return {
        ok: run("git", ["clone", "--depth", "1", "https://github.com/github/awesome-copilot", "vendor/awesome-copilot"], { inherit: true, timeout: 600_000 }).ok,
      };
    },
    hint: "git clone https://github.com/github/awesome-copilot vendor/awesome-copilot  (o define GRU_AWESOME_COPILOT_PATH)",
  },
  {
    id: "deepagents (workflows persistentes)",
    detect: () => {
      const entry = process.env.GRU_DEEPAGENTS_ENTRY;
      return entry && existsSync(entry) ? entry : null;
    },
    install: () => null, // requires a user-provided adapter — cannot be automated
    hint: "Define GRU_DEEPAGENTS_ENTRY apuntando a un adaptador ejecutable: node deepagents-adapter.mjs run \"prompt\"",
  },
  {
    id: "context7 (documentación técnica, MCP)",
    detect: () => (has("npx") ? "vía npx bajo demanda (.mcp.json)" : null),
    install: () => null,
    hint: "Requiere Node/npx. Se lanza bajo demanda desde .mcp.json (@upstash/context7-mcp).",
  },
];

const results = [];

for (const provider of PROVIDERS) {
  let detected = null;
  try {
    detected = provider.detect();
  } catch {
    detected = null;
  }

  if (detected) {
    results.push({ id: provider.id, status: "READY", detail: detected });
    console.log(`✔ ${provider.id} — READY (${detected})`);
    continue;
  }

  if (CHECK_ONLY) {
    results.push({ id: provider.id, status: "MISSING", detail: provider.hint });
    console.log(`✘ ${provider.id} — MISSING`);
    console.log(`  → ${provider.hint}`);
    continue;
  }

  const wants = await confirm(`✘ ${provider.id} no está instalado. ¿Instalar ahora?`);
  if (!wants) {
    results.push({ id: provider.id, status: "SKIPPED", detail: provider.hint });
    console.log(`- ${provider.id} — omitido. Instalación manual: ${provider.hint}`);
    continue;
  }

  const outcome = provider.install ? provider.install() : null;
  if (outcome === null) {
    results.push({ id: provider.id, status: "MANUAL", detail: provider.hint });
    console.log(`! ${provider.id} — requiere acción manual: ${provider.hint}`);
  } else if (outcome.ok) {
    results.push({ id: provider.id, status: "INSTALLED", detail: "" });
    console.log(`✔ ${provider.id} — instalado.`);
  } else {
    results.push({ id: provider.id, status: "FAILED", detail: provider.hint });
    console.log(`✘ ${provider.id} — la instalación falló. Manual: ${provider.hint}`);
  }
}

console.log("\nResumen:");
for (const r of results) {
  console.log(`  ${r.status.padEnd(9)} ${r.id}`);
}

const missing = results.filter((r) => r.status === "MISSING" || r.status === "FAILED");
if (missing.length > 0) {
  console.log(`\n${missing.length} provider(s) pendientes. Gru bloqueará las tareas que los requieran (runtime estricto: nunca simula).`);
  process.exitCode = 2;
} else {
  console.log("\nTodos los providers verificados. Ejecuta: pnpm gru status");
}
