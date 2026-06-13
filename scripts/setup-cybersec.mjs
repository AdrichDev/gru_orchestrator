#!/usr/bin/env node
/**
 * Gru-CyberSec — harness bootstrap.
 *
 * Verifies the Blue/Red/Purple cybersecurity harness ships intact whenever
 * gru-orchestrator is installed, and self-wires the skill registry. Pure Node
 * builtins, cross-platform (Windows / macOS / Linux).
 *
 * Modes:
 *   node scripts/setup-cybersec.mjs               # verify + wire + typecheck/test
 *   node scripts/setup-cybersec.mjs --check       # report only, exit 2 if anything missing
 *   node scripts/setup-cybersec.mjs --yes         # non-interactive (same as default, no prompts)
 *   node scripts/setup-cybersec.mjs --postinstall # light: presence + registry wiring, NEVER fails install
 *
 * Wired into package.json `postinstall`, so it runs automatically on install.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARGV = process.argv.slice(2);
const CHECK_ONLY = ARGV.includes("--check");
const POSTINSTALL = ARGV.includes("--postinstall");
const IS_WIN = process.platform === "win32";

const log = (s = "") => console.log(s);
const rel = (p) => path.join(ROOT, p);

// ---------------------------------------------------------------------------
// Expected harness assets
// ---------------------------------------------------------------------------
const PACKAGE_FILES = [
  "packages/cybersec/package.json",
  "packages/cybersec/src/index.ts",
  "packages/cybersec/src/severity.ts",
  "packages/cybersec/src/patterns.ts",
  "packages/cybersec/src/teams.ts",
  "packages/cybersec/src/loop.ts",
  "packages/cybersec/src/learning.ts",
  "packages/cybersec/src/__tests__/cybersec.test.ts",
];

const AGENTS = [
  "redteam-coordinator",
  "redteam-recon",
  "redteam-exploit",
  "blueteam-coordinator",
  "blueteam-hardening",
  "blueteam-detect",
  "blueteam-incident",
  "purpleteam-coordinator",
].map((n) => `.claude/agents/cybersec/${n}.agent.md`);

const SKILLS = [
  "cybersec-audit",
  "redteam-attack",
  "blueteam-defense",
  "threat-modeling",
  "purple-loop",
];
const SKILL_FILES = SKILLS.map((n) => `.claude/skills/${n}/SKILL.md`);

const DOCS = ["cybersec-minion-contract.md", "docs/cybersec/ATTACK-DEFENSE-PLAYBOOK.md"];

const GOVERNANCE = [
  "CLAUDE.md",
  ".claude/CLAUDE.md",
  "AGENTS.md",
  ".codex/AGENTS.md",
  ".config/opencode/AGENTS.md",
  ".gemini/GEMINI.md",
];
const GOV_MARKERS = ["CYBERSECURITY HARNESS", "HARNESS DE CIBERSEGURIDAD"];

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------
const missing = [];
const present = [];

function checkFiles(label, files) {
  for (const f of files) {
    if (existsSync(rel(f))) present.push(f);
    else missing.push(`${label}: ${f}`);
  }
}

checkFiles("package", PACKAGE_FILES);
checkFiles("agent", AGENTS);
checkFiles("skill", SKILL_FILES);
checkFiles("doc", DOCS);

for (const g of GOVERNANCE) {
  const p = rel(g);
  if (!existsSync(p)) {
    missing.push(`governance(file): ${g}`);
    continue;
  }
  const txt = readFileSync(p, "utf8");
  if (GOV_MARKERS.some((m) => txt.includes(m))) present.push(`governance: ${g}`);
  else missing.push(`governance(section): ${g}`);
}

// ---------------------------------------------------------------------------
// Self-wire the skill registry (idempotent)
// ---------------------------------------------------------------------------
function wireRegistry() {
  const regPath = rel(".atl/skill-registry.md");
  if (!existsSync(regPath)) return "no-registry";
  let txt = readFileSync(regPath, "utf8");
  if (SKILLS.every((s) => txt.includes(s))) return "already-wired";

  const base = path.join(ROOT, ".claude", "skills");
  const rows = {
    "cybersec-audit":
      "Entry point for all Gru-CyberSec work. Trigger: security audit, vulnerability scan, pentest, harden, threat model, red/blue/purple team, CVE, OWASP, CWE.",
    "redteam-attack":
      "Offensive minions: recon + exploit. Trigger: exploit, PoC, attack, penetration test, bypass, payload, red team. ROE-bound (own code / sandbox only).",
    "blueteam-defense":
      "Defensive minions: harden, detect, incident. Trigger: harden, fix vulnerability, secure pattern, mitigation, detection, regression test, blue team.",
    "threat-modeling":
      "STRIDE threat modeling + attack trees. Trigger: threat model, STRIDE, attack tree, trust boundary, attack surface, abuse case.",
    "purple-loop":
      "Cyclic red-vs-blue self-training loop. Trigger: red vs blue, security loop, self-training security, harden cyclically, make it inexpugnable.",
  };
  const block =
    SKILLS.filter((s) => !txt.includes(s))
      .map((s) => `| \`${s}\` | ${rows[s]} | project | \`${path.join(base, s, "SKILL.md")}\` |`)
      .join("\n") + "\n";
  const marker = "| Skill | Trigger / description | Scope | Path |\n| --- | --- | --- | --- |\n";
  if (!txt.includes(marker)) return "no-table";
  txt = txt.replace(marker, marker + block);
  writeFileSync(regPath, txt);
  return "wired";
}

let registryState = "skipped";
try {
  registryState = wireRegistry();
} catch (e) {
  registryState = `error: ${e.message}`;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
log("Gru-CyberSec harness check");
log(`  assets present : ${present.length}`);
log(`  assets missing : ${missing.length}`);
log(`  skill registry : ${registryState}`);
if (missing.length) {
  log("\nMissing:");
  for (const m of missing) log(`  ✘ ${m}`);
}

// ---------------------------------------------------------------------------
// postinstall mode: never break the install
// ---------------------------------------------------------------------------
if (POSTINSTALL) {
  if (missing.length) {
    log(
      "\n! Gru-CyberSec assets incomplete. Run `pnpm setup:cybersec` to verify/repair.",
    );
  } else {
    log("\n✔ Gru-CyberSec harness present and wired.");
  }
  process.exitCode = 0; // postinstall must not fail the install
} else if (CHECK_ONLY) {
  process.exitCode = missing.length ? 2 : 0;
} else {
  // full mode: typecheck + test the package
  if (missing.length) {
    log("\n✘ Harness incomplete — fix the missing assets above before testing.");
    process.exitCode = 2;
  } else {
    const pm = (() => {
      const r = spawnSync("pnpm", ["--version"], { shell: IS_WIN, encoding: "utf8" });
      return r.status === 0 ? "pnpm" : "npm";
    })();
    log(`\nRunning typecheck + tests for @gru/cybersec via ${pm}...`);
    const args =
      pm === "pnpm"
        ? ["--filter", "@gru/cybersec", "run", "test"]
        : ["test", "--workspace", "@gru/cybersec"];
    const r = spawnSync(pm, args, { cwd: ROOT, shell: IS_WIN, stdio: "inherit" });
    if (r.status === 0) {
      log("\n✔ Gru-CyberSec harness installed, wired and verified.");
      process.exitCode = 0;
    } else {
      log("\n✘ Harness tests failed. Inspect output above.");
      process.exitCode = 1;
    }
  }
}
