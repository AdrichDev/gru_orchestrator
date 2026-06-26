#!/usr/bin/env node
// create-gru — instala el harness Gru (modo B) en un proyecto.
// Cero dependencias. Copia desde el ./template empaquetado (NO desde el repo),
// así `pnpm dlx create-gru` es instantáneo: sin monorepo, sin workspace:*,
// sin postinstall, sin deps nativas.
//
//   pnpm dlx create-gru init [destino] [flags]
//   npm create gru [destino]            # (create-* convention)
//   node packages/create-gru/index.mjs init [destino]
//
// Interactivo por TTY (pregunta grupo por grupo). Sin TTY → perfil recomendado.

import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, statSync, readdirSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(__dirname, "template");

// --- args -----------------------------------------------------------------
const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === "init" ? rawArgs.slice(1) : rawArgs; // tolera "init"
const flags = new Set(args.filter((a) => a.startsWith("--") || a === "-y"));
const positionals = args.filter((a) => !a.startsWith("-"));

const MINIMAL = flags.has("--minimal");
const FORCE = flags.has("--force");
const YES = flags.has("--yes") || flags.has("-y");
const DRY = flags.has("--dry-run");

if (flags.has("--help") || flags.has("-h")) { printHelp(); process.exit(0); }

const TARGET = resolve(positionals[0] ?? process.cwd());
const INTERACTIVE = process.stdin.isTTY && !YES && !MINIMAL && !DRY;

if (!existsSync(TEMPLATE)) {
  console.error("Falta el directorio ./template en el paquete. Ejecuta build:template.");
  process.exit(1);
}

// --- catálogo de grupos ---------------------------------------------------
// src = ruta relativa dentro de template/. required no se pregunta.
const GROUPS = [
  { id: "core", required: true, label: "Persona Gru + contrato de minions",
    paths: [".claude/CLAUDE.md", "minion-contract.md"] },
  { id: "contracts", default: true, label: "Contrato cybersec + SDD.md",
    paths: ["cybersec-minion-contract.md", "SDD.md"] },
  { id: "mcp", default: true, label: "Config MCP (.mcp.json: ruflo, context7, engram)",
    paths: [".mcp.json"] },
  { id: "agents", default: true, label: "Minions / subagentes Gru (.claude/agents)",
    paths: [".claude/agents"] },
  { id: "styles", default: true, label: "Output styles (caveman, etc.)",
    paths: [".claude/output-styles"] }
];

// --- main -----------------------------------------------------------------
main().catch((err) => { console.error(err); process.exitCode = 1; });

async function main() {
  console.log(`\nGru harness installer (create-gru, modo B)`);
  console.log(`Template: ${TEMPLATE}`);
  console.log(`Destino : ${TARGET}`);
  console.log(`Modo    : ${INTERACTIVE ? "interactivo" : MINIMAL ? "minimal" : DRY ? "dry-run" : "recomendado"}\n`);

  if (resolve(TEMPLATE) === TARGET) {
    console.error("Destino = template. Aborto.");
    process.exit(2);
  }

  const enabled = await resolveSelection();

  let copied = 0, skipped = 0;
  for (const group of GROUPS) {
    if (!group.required && !enabled.has(group.id)) continue;
    for (const p of group.paths) {
      const r = copyPath(p);
      copied += r.copied;
      skipped += r.skipped;
    }
  }

  console.log(`\nListo. ${copied} archivos copiados, ${skipped} omitidos.`);
  if (!DRY) printNextSteps();
}

// --- selección ------------------------------------------------------------
async function resolveSelection() {
  const optional = GROUPS.filter((g) => !g.required);
  if (MINIMAL) return new Set();
  if (!INTERACTIVE) return new Set(optional.filter((g) => g.default).map((g) => g.id));

  console.log("Elige qué instalar (Enter = valor por defecto):\n");
  const enabled = new Set();
  const rl = readline.createInterface({ input, output });
  const ac = new AbortController();
  const onEnd = () => ac.abort();
  input.once("end", onEnd);
  input.once("close", onEnd);
  try {
    for (let i = 0; i < optional.length; i++) {
      const g = optional[i];
      let ans;
      try {
        ans = (await rl.question(`  ${g.label}? ${g.default ? "(S/n)" : "(s/N)"} `, { signal: ac.signal }))
          .trim().toLowerCase();
      } catch {
        // stdin cerrado a mitad: el resto toma su valor por defecto.
        for (const rest of optional.slice(i)) if (rest.default) enabled.add(rest.id);
        break;
      }
      const yes = ans === "" ? g.default : /^s|^y/.test(ans);
      if (yes) enabled.add(g.id);
    }
  } finally {
    input.off("end", onEnd);
    input.off("close", onEnd);
    rl.close();
  }
  return enabled;
}

// --- copia por archivo (merge, nunca skip de directorio entero) ------------
function copyPath(relPath) {
  const src = join(TEMPLATE, relPath);
  if (!existsSync(src)) {
    console.warn(`  SKIP  ${relPath} (no está en el template)`);
    return { copied: 0, skipped: 1 };
  }
  return statSync(src).isDirectory() ? copyDir(relPath) : copyFile(relPath);
}

function copyDir(relPath) {
  let copied = 0, skipped = 0;
  const src = join(TEMPLATE, relPath);
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const child = `${relPath}/${entry.name}`;
    const r = entry.isDirectory() ? copyDir(child) : copyFile(child);
    copied += r.copied; skipped += r.skipped;
  }
  return { copied, skipped };
}

function copyFile(relPath) {
  const src = join(TEMPLATE, relPath);
  const dst = join(TARGET, relPath);
  const exists = existsSync(dst);

  if (exists && !FORCE) {
    console.log(`  SKIP  ${relPath} (ya existe — usa --force)`);
    return { copied: 0, skipped: 1 };
  }
  if (DRY) {
    console.log(`  COPY  ${relPath}${exists ? " (overwrite)" : ""}`);
    return { copied: 1, skipped: 0 };
  }
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst);
  console.log(`  ${exists ? "OVERWRITE" : "COPY"}  ${relPath}`);
  return { copied: 1, skipped: 0 };
}

// --- final ----------------------------------------------------------------
function printNextSteps() {
  const rel = relative(process.cwd(), TARGET) || ".";
  console.log(`
Siguientes pasos:
  1. Abre el proyecto con tu harness (Claude Code: 'claude' en ${rel}).
  2. Si usas el MCP de engram, ajústalo en ${join(rel, ".mcp.json")}
     (ENGRAM_BIN debe apuntar a tu binario si no está en PATH).
  3. Instala los providers que vayas a usar, p.ej.:
       npm install -g pi && pi install npm:gentle-engram   # engram
       pnpm dlx ruflo@latest init wizard                    # ruflo (swarm)
       pnpm add -D ecc-universal                            # ecc (seguridad)

Nota: este instalador trae solo los minions Gru-nativos; no incluye los
agents/skills específicos de claude-flow.`);
}

function printHelp() {
  console.log(`
create-gru — instala el harness Gru (modo B) en un proyecto. Cero dependencias.

Uso:
  pnpm dlx create-gru init [destino] [flags]
  node packages/create-gru/index.mjs init [destino] [flags]

Interactivo con TTY (pregunta qué piezas instalar). Sin TTY → recomendado.
Siempre copia CLAUDE.md + minion-contract.md.

Flags:
  --yes, -y    No preguntar: perfil recomendado.
  --minimal    Solo CLAUDE.md + minion-contract.md.
  --force      Sobrescribe archivos existentes (copia por archivo, hace merge).
  --dry-run    Muestra qué haría, sin escribir.
  -h, --help   Esta ayuda.`);
}
