#!/usr/bin/env node
// build-installer-template — genera packages/create-gru/template/ a partir del
// repo, curando solo los assets genéricos del harness Gru (sin bloat de
// claude-flow: swarm/consensus/sparc/core/browser/testing, ni skills v3/agentdb).
//
// Fuente única de verdad = el repo. El template es derivado: se regenera antes
// de publicar (prepublishOnly). Así no hay drift manual.
//
//   node scripts/build-installer-template.mjs

import {
  existsSync, mkdirSync, cpSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync
} from "node:fs";
import { dirname, join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "packages", "create-gru", "template");

// Directorios de agents que NO son del harness Gru (claude-flow / SPARC swarm).
const AGENT_DIR_DENYLIST = new Set(["browser", "consensus", "core", "sparc", "swarm", "testing"]);

console.log(`Generando template del instalador en:\n  ${OUT}\n`);

// limpia salida previa
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let count = 0;
const copyFile = (from, to, transform) => {
  const src = join(ROOT, from);
  if (!existsSync(src)) {
    console.warn(`  SKIP  ${from} (no existe)`);
    return;
  }
  const dst = join(OUT, to);
  mkdirSync(dirname(dst), { recursive: true });
  if (transform) writeFileSync(dst, transform(readFileSync(src, "utf8")), "utf8");
  else cpSync(src, dst);
  count++;
};

// 1. Archivos estáticos del harness ----------------------------------------
copyFile(".claude/CLAUDE.md", ".claude/CLAUDE.md");
copyFile("minion-contract.md", "minion-contract.md");
copyFile("cybersec-minion-contract.md", "cybersec-minion-contract.md");
copyFile("SDD.md", "SDD.md");
copyFile(".mcp.json", ".mcp.json", portableMcp);

// 2. output-styles (persona caveman, etc.) — completo, es pequeño y Gru-nativo
copyDirAll(".claude/output-styles", ".claude/output-styles");

// 3. agents curados: raíz (.md) + cybersec/, excluyendo dirs claude-flow ----
const agentsSrc = join(ROOT, ".claude", "agents");
for (const entry of readdirSync(agentsSrc, { withFileTypes: true })) {
  if (entry.isFile() && extname(entry.name) === ".md") {
    copyFile(`.claude/agents/${entry.name}`, `.claude/agents/${entry.name}`);
  } else if (entry.isDirectory() && !AGENT_DIR_DENYLIST.has(entry.name)) {
    copyDirAll(`.claude/agents/${entry.name}`, `.claude/agents/${entry.name}`);
  }
}

console.log(`\nListo. ${count} archivos en el template.`);

// --- helpers --------------------------------------------------------------
function copyDirAll(fromRel, toRel) {
  const src = join(ROOT, fromRel);
  if (!existsSync(src)) {
    console.warn(`  SKIP  ${fromRel} (no existe)`);
    return;
  }
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const childFrom = `${fromRel}/${entry.name}`;
    const childTo = `${toRel}/${entry.name}`;
    if (entry.isDirectory()) copyDirAll(childFrom, childTo);
    else copyFile(childFrom, childTo);
  }
}

// engram MCP: portable (PATH) y NO eager — no intenta arrancar si engram falta.
function portableMcp(content) {
  try {
    const json = JSON.parse(content);
    const engram = json?.mcpServers?.engram;
    if (engram) {
      if (engram.env?.ENGRAM_BIN) engram.env.ENGRAM_BIN = "engram";
      // evita exit 127 ruidoso en cada boot si engram no está instalado
      if (engram.lifecycle === "eager") engram.lifecycle = "lazy";
      delete engram.directTools;
    }
    return JSON.stringify(json, null, 2) + "\n";
  } catch {
    return content;
  }
}
