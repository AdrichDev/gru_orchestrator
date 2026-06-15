#!/usr/bin/env node
/**
 * port-cybersec-agents.cjs — port .claude/agents/cybersec/*.agent.md to
 * Gemini CLI (.gemini/agents/cybersec/*.md) and Codex CLI (.codex/agents/cybersec/*.toml).
 *
 * The agent BODY (ROE, charter, skills, contracts) is harness-agnostic and reused verbatim.
 * Only the frontmatter / config envelope is translated per harness.
 *
 * Source of truth: Claude Code agent files (already fixed to real tool names).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, '.claude/agents/cybersec');
const GEMINI_DIR = path.join(ROOT, '.gemini/agents/cybersec');
const CODEX_DIR = path.join(ROOT, '.codex/agents/cybersec');

// Claude tool name -> Gemini tool name. Agent (delegation) has no Gemini tool equivalent
// (subagents are invoked via @name, not a tool) -> dropped.
const GEMINI_TOOL = {
  Read: 'read_file',
  Grep: 'grep_search',
  Glob: 'glob',
  Bash: 'run_shell_command',
  Edit: 'replace',
  Write: 'write_file',
  WebFetch: 'web_fetch',
  WebSearch: 'google_web_search',
  Agent: null,
};

// Codex declares no per-name tools; permission is governed by sandbox_mode.
// Agents that write code/files need workspace-write; read-only otherwise.
const WRITES = new Set(['redteam-exploit', 'blueteam-hardening', 'blueteam-detect', 'blueteam-incident']);
// Heavier reasoning for planners/exploit.
const HIGH_EFFORT = new Set([
  'redteam-coordinator', 'blueteam-coordinator', 'purpleteam-coordinator', 'redteam-exploit',
]);

/** Split a *.agent.md into { fm: rawFrontmatter, body } */
function parse(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error('No frontmatter found');
  return { fm: m[1], body: m[2].replace(/^\s+/, '') };
}

/** Extract a scalar field (quoted or bare) from raw frontmatter. */
function field(fm, key) {
  const re = new RegExp(`^${key}\\s*:\\s*(.+)$`, 'm');
  const m = fm.match(re);
  if (!m) return undefined;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

/** Extract the tools array (inline JSON-ish) from raw frontmatter. */
function toolsArray(fm) {
  const m = fm.match(/^tools\s*:\s*\[(.*)\]\s*$/m);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

function tomlEscape(s) {
  return s; // body goes in a triple-quoted TOML string; no escaping needed for our content
}

function main() {
  fs.mkdirSync(GEMINI_DIR, { recursive: true });
  fs.mkdirSync(CODEX_DIR, { recursive: true });

  const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.agent.md'));
  const report = [];

  for (const file of files) {
    const slug = file.replace(/\.agent\.md$/, ''); // e.g. redteam-recon
    const raw = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
    const { fm, body } = parse(raw);

    const claudeName = field(fm, 'name') || `cybersec:${slug}`;     // "cybersec:redteam-recon"
    const description = field(fm, 'description') || '';
    const claudeTools = toolsArray(fm);

    // ---- Gemini ----------------------------------------------------------
    const gemTools = claudeTools
      .map((t) => GEMINI_TOOL[t])
      .filter((t) => t != null);
    const gemName = claudeName.replace(/:/g, '-'); // Gemini @name has no ':'
    const gemFm = [
      '---',
      `name: ${gemName}`,
      `description: ${JSON.stringify(description)}`,
      'tools:',
      ...gemTools.map((t) => `  - ${t}`),
      'model: inherit',
      '---',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(GEMINI_DIR, `${slug}.md`), gemFm + body, 'utf8');

    // ---- Codex (TOML) ----------------------------------------------------
    const sandbox = WRITES.has(slug) ? 'workspace-write' : 'read-only';
    const effort = HIGH_EFFORT.has(slug) ? 'high' : 'medium';
    const codexToml = [
      `name = ${JSON.stringify(claudeName)}`,
      `description = ${JSON.stringify(description)}`,
      `model_reasoning_effort = ${JSON.stringify(effort)}`,
      `sandbox_mode = ${JSON.stringify(sandbox)}`,
      '',
      'developer_instructions = """',
      tomlEscape(body).trimEnd(),
      '"""',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(CODEX_DIR, `${slug}.toml`), codexToml, 'utf8');

    report.push({ slug, gemName, gemTools: gemTools.join(','), sandbox, effort });
  }

  console.log(`Ported ${report.length} agents:\n`);
  for (const r of report) {
    console.log(`  ${r.slug}`);
    console.log(`    gemini: @${r.gemName} tools=[${r.gemTools}]`);
    console.log(`    codex:  sandbox=${r.sandbox} effort=${r.effort}`);
  }
}

main();
