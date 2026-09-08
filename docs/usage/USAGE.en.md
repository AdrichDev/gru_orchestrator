<div align="center">

<img src="../../docs/assets/gru-banner.svg" alt="GRU Harness — orchestrator" width="640">

</div>

> **"Gru coordinates. Minions produce. Policies govern. Human approves."**

<div align="center">

![Node](https://img.shields.io/badge/node-%3E%3D20-3c873a) ![Runtime](https://img.shields.io/badge/runtime-strict-facc15) ![Niveles](https://img.shields.io/badge/niveles-0--4-64748b) ![Harness](https://img.shields.io/badge/blue%2Fred%2Fpurple-cybersec-8b5cf6)

</div>

---

<div align="center">

🇪🇸 [**Español**](../../USAGE.md) &nbsp;|&nbsp; 🇺🇸 [**English**](USAGE.en.md) &nbsp;|&nbsp; 🇨🇳 [**中文**](USAGE.zh.md) &nbsp;|&nbsp; 🇫🇷 [**Français**](USAGE.fr.md) &nbsp;|&nbsp; 🇩🇪 [**Deutsch**](USAGE.de.md)

</div>

---

# Gru Harness — Usage Guide (reference)

Full reference for the `gru` CLI (package `@adrichdev/gru-harness`, private repo —
installed from Git, not from the public registry). For the project overview, see
[README.md](../../README.md). For the strict provider runtime, see
[STRICT_PROVIDER_RUNTIME.md](../../STRICT_PROVIDER_RUNTIME.md).

---

## Where does the harness run and what must be copied?

There are **two ways** to use Gru, and the answer depends on which one you use. Do not mix them.

### A) The `gru` CLI (standalone)

- Installed **once, globally** (`pnpm add -g github:AdrichDev/gru_orchestrator`).
  It exposes the `gru` command system-wide.
- You do **not** need to be inside the gru_orchestrator folder. That repo is only for
  *developing* the harness. To *use* it, you run `gru` from the **root of YOUR project**
  (the one you are working on).
- The `cwd` defines: config scope (`<cwd>/.gru/`), filesystem scan target, and the logs
  (`runs/run_*.json`). That is why you run it at your project root, not gru's.
- **Copy canonical files?** For the CLI to *start*, no: `postinstall` seeds `~/.gru/*` and
  that is enough. You only need `gru init` in your project if you want project-scoped config,
  contracts, or a local `.mcp.json`.

### B) The persona inside an LLM harness (Claude Code, Codex, Gemini, Cursor…)

- These tools auto-load their canonical file **from the `cwd` tree**: Claude Code reads
  `CLAUDE.md`; Codex/Cursor/Antigravity read `AGENTS.md`; Gemini reads `GEMINI.md`.
- **Here you DO need the canonical files at the root of YOUR project.** The gru repo files
  are **not enough**: they only load when you are working *inside* `gru_orchestrator`. Another
  project does not read a foreign repo's `CLAUDE.md`/`AGENTS.md`.
- To seed them in your project: `gru init --runtime <tool>` (see
  [`gru init`](#gru-init--full-reference)). It writes the canonical file of the chosen runtime
  plus the shared files (`.gru/*`, contracts, `.mcp.json`).

### Summary

| Question | Answer |
| :--- | :--- |
| Be inside the gru folder? | **No.** Only to develop the harness. To use it, run from your project root. |
| Where do I run `gru`? | At the **root of the project you are working on** (the `cwd` defines config/scan/logs). |
| Are the gru repo files enough? | **CLI:** yes (global + `~/.gru/`). **LLM persona:** no — each tool only reads the canonical file from its own `cwd` tree. |
| Must I copy canonical files to the project root? | **Only for the LLM persona.** Use `gru init --runtime <tool>`. The CLI does not need it to start. |

---

## Installation

```bash
# Private repo → install directly from Git (no manual clone; exposes the `gru` command).
pnpm add -g github:AdrichDev/gru_orchestrator
# or via SSH:
pnpm add -g git+ssh://git@github.com/AdrichDev/gru_orchestrator.git
```

Requires access to the private repo, **git** and **Node.js 20+**. The install compiles the
bundle on your machine (`prepare` script → tsup). It is not published to the public npm registry.

### What `postinstall` does

After the global install, the bootstrap (`scripts/postinstall.mjs`) **never fails the
install** (it always exits with code 0) and:

1. Creates `~/.gru/` (idempotent).
2. Seeds the default YAML files from `templates/.gru/` (config, providers, skills) without
   overwriting what already exists.
3. Prints a notice: the **awesome-copilot catalog is opt-in** — it is NOT downloaded here.
   To download it, use `gru init --awesome-copilot`.

In a monorepo context (source checkout) it delegates to the cybersec harness verification
instead of the global bootstrap.

---

## Commands

```bash
gru "<prompt>"                       # orchestrate a task: classify → route → execute
gru status                           # real provider status (alias: doctor, /status)
gru --agentic "<prompt>"             # agentic pipeline: executor → reviewer → tester + gates
gru --agentic "<prompt>" --phase apply --sdd my-change
gru init [options]                   # multi-runtime scaffolding (see below)
```

Running `gru` with no arguments prints the usage help.

### `gru "<prompt>"`

Orchestrates a task end to end:

```text
1. classifyTask()      → level 0-4 + risk signals (bilingual ES/EN)
2. Approval gate       → if there is risk: "Approve execution? (yes/NO)"
3. routeTask()         → picks the provider by keywords (gentlePi, ecc, engram...)
4. Devil's Advocate    → pre-flight veto (missing provider, catalog as executor)
5. Real health check   → if the provider is not installed: BLOCKED + how to install it
6. Real execution      → result + auditable log in runs/run_*.json
```

**Human approval gate**

- In an interactive terminal: Gru asks `Approve execution of this task? (yes/NO)`
  and only continues with an explicit `yes`.
- In CI / non-TTY: the task is **not executed** and the process exits with **exit code 2**.
- Writing "it is already approved" or "it is just a test" inside the prompt **does not count
  as approval** — the gate only accepts the explicit channel.
- Every execution is logged in `runs/run_*.json` with classification, level, provider,
  command, exit code, and whether there was human approval.

**Provider fallback**: if the chosen provider is unavailable but installed alternatives
exist, in TTY Gru offers to pick one. In non-TTY: exit code 2, nothing simulated.

### `gru status`

Prints a table with the REAL status of each connector (alias: `doctor`, `/status`,
`/doctor`). Each row shows provider, kind, status, executable, version, and reason.

| Status | Meaning |
| :--- | :--- |
| `READY` | provider available and verified |
| `CONFIGURADO` | available via configuration (`status: configured`) |
| `MISSING` | required but not installed → appears under "Required actions" |
| `INCOMPATIBLE` | installed but incompatible version |
| `DISABLED (opcional)` | `enabled: false` in `providers.yaml` (informational) |
| `HOST-MANAGED (PENDIENTE)` | sdk provider whose host adapter is not active yet |
| `OPCIONAL (no configurado)` | optional sdk provider, not configured |
| `CATÁLOGO AUSENTE` | catalog (awesomeCopilot) not cloned |

Only genuinely required-but-missing providers appear under "Required actions". The
`DISABLED`, `HOST-MANAGED (PENDIENTE)` and `OPCIONAL` ones are informational and are excluded.

```bash
gru status --strict     # CI: exit code 2 if any required provider is missing
```

### `gru --agentic`

Agentic pipeline with gates: executor → reviewer → tester. Prints `APROBADO ✓` or
`RECHAZADO ✗`, the blockers, and the status of each gate. If it is not approved → exit code 2.

```bash
gru --agentic "<prompt>"
gru --agentic "<prompt>" --phase apply --sdd my-change
```

- `--phase <phase>`: SDD phase (default `apply`).
- `--sdd <id>`: SDD change id (default `current`).

---

## `gru init` — full reference

Scaffolds the harness files into a project. Multi-runtime: it writes **only** the files of
the chosen runtime(s), plus the shared files.

```bash
gru init                                   # interactive menu: runtime(s) + scope
gru init --runtime claude,cursor           # without asking for runtime
gru init --runtime all --scope project     # all runtimes in this repo
gru init --awesome-copilot                 # also downloads the skills catalog
```

### Flags

| Flag | Values | Effect |
| :--- | :--- | :--- |
| `--runtime` | `claude,codex,gemini,opencode,cursor,antigravity` (CSV) or `all` | Runtimes to scaffold. Default non-TTY: `claude`. Default TTY: multi-select menu. |
| `--scope` | `project` \| `global` | `project` writes to `<cwd>/.gru/` and `<cwd>/`; `global` only to `~/.gru/`. Default non-TTY: `project`. If `<cwd>/.gru/` already exists it infers `project`. |
| `--force` | — | Overwrites existing files. Saves a `.bak` first. In TTY it lists the files and requires confirmation by typing `yes`. |
| `--awesome-copilot` / `--skills` | — | Downloads the awesome-copilot catalog (~100MB) into `~/.gru/awesome-copilot`. Opt-in. |

Re-running `gru init` is idempotent: existing files are skipped unless `--force` is passed.
If `--awesome-copilot` is not passed and there is a TTY, it asks (default No).

### What each runtime scaffolds

| Runtime | Files |
| :--- | :--- |
| **claude** | `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/agents/cybersec/*`, `.claude/skills/*` (cybersec-audit, redteam-attack, blueteam-defense, threat-modeling, purple-loop), `.atl/skill-registry.md` |
| **codex** | `.codex/AGENTS.md`, `AGENTS.md` (root), `.codex/agents/cybersec/*.toml` |
| **gemini** | `.gemini/GEMINI.md`, `.gemini/agents/cybersec/*.md` |
| **opencode** | `.config/opencode/AGENTS.md`, `.config/opencode/opencode.json` |
| **cursor** | `.cursor/rules/gru.mdc`, `AGENTS.md` (root) |
| **antigravity** | `AGENTS.md` (root) |
| **Shared (always)** | `.gru/config.yaml`, `.gru/providers.yaml`, `.gru/skills.yaml`, `minion-contract.md`, `cybersec-minion-contract.md`, `.mcp.json` |

The root `AGENTS.md` is shared by codex/cursor/antigravity: it is deduplicated by target
(written only once). With `--scope global`, files marked project-only (contracts, `.mcp.json`,
runtime files) are not written; only the shared `.gru/*` files are seeded into `~/.gru/`.

`.mcp.json` registers the MCP servers for **context7** and
**engram**. Adjust `ENGRAM_BIN` to your local path.

---

## Providers / connectors

Gru does not produce artifacts: it delegates to specialized providers. The catalog:

| Provider ID | Executable / Command | Role | External | Install hint |
| :--- | :--- | :--- | :--- | :--- |
| **local** | direct command | Local workspace tasks (filesystem, git, npm, tests). | no | — |
| **gentlePi** | `gentle-ai`/`pi` | SDD/OpenSpec specification and disciplined TDD. | yes | `pi install npm:gentle-pi` (requires `pi`) |
| **gentlemanCli** | `gentle-ai` | Environment diagnostics, skill updates and sync. | yes | official installer (macOS/Linux); Windows: manual or WSL |
| **ecc** | `ecc` | Security audit, policies and CVE detection. | yes | `pnpm add -D ecc-universal` |
| **deepagents** | own adapter | Long-running persistent workflows with checkpoints. | yes | set `GRU_DEEPAGENTS_ENTRY` pointing to your adapter |
| **engram** | `engram` | Persistent memory of decisions and context. | yes | `pi install npm:gentle-engram` or set `ENGRAM_BIN` |
| **awesomeCopilot** | local catalog | Search of community skills (`SKILL.md`). **Catalog only: never executes.** | yes | `gru init --awesome-copilot` or set `GRU_AWESOME_COPILOT_PATH` |

**Strict runtime**: Gru **never simulates responses**. If a required provider is not
installed, it blocks the task (`[BLOCKED]`) and shows the exact hint to install it. See
[STRICT_PROVIDER_RUNTIME.md](../../STRICT_PROVIDER_RUNTIME.md).

**awesome-copilot is search-only**: the harness searches the catalog and **only reads the
matching `SKILL.md`** — it never executes the catalog as a provider.

### Real routing examples

| Prompt | Level | Asks? | Provider |
| :--- | :--- | :--- | :--- |
| `generate the openspec sdd for the new API` | 0 | no | gentlePi |
| `remember that we decided to use JWT without sessions` | 0 | no | engram |
| `search the catalog for a code review skill` | 0 | no | awesomeCopilot |
| `audit security and review CVEs` | 2 | **yes** | ecc |
| `delete the production database` | 4 | **yes** | blocked without approval |

---

## Devil's Advocate — Rigidity levels

The Devil's Advocate reviews every delegation before the provider runs. It has **hard rules**
(always block) and one **soft rule** (routing confidence, configurable).

### Hard rules — always active regardless of level

| Rule | Effect |
| :--- | :--- |
| Provider unavailable | BLOCKED — Gru never simulates executions. |
| Provider of type `catalog` with execution intent | BLOCKED — catalogs are search-only. |

### Soft rule — governed by `devil.rigidity`

| Level | Behavior |
| :--- | :--- |
| `advisory` | Never warns or blocks on low confidence. Only hard rules active. |
| `strict` | **(DEFAULT)** Warns when confidence < `minConfidence` (default 30%). Never blocks on confidence. Reproduces the previous behavior exactly — an absent config is identical. |
| `paranoid` | Warns when confidence < `max(minConfidence, 60)`; **BLOCKS** when confidence < `minConfidence`. The message asks you to confirm the provider explicitly. |

### Configuration in `.gru/config.yaml`

```yaml
devil:
  rigidity: strict        # advisory | strict | paranoid (default: strict)
  minConfidence: 30       # confidence threshold % (default: 30)
```

Absent config or absent `devil` section = `strict` behavior with `minConfidence 30`
(full backward compatibility).

---

## Environment variables

| Variable | Purpose |
| :--- | :--- |
| `GRU_CONFIG_DIR` | alternative path to the configuration directory (default `~/.gru` or `<cwd>/.gru`) |
| `GRU_RUNS_DIR` | alternative path for the execution logs (`runs/run_*.json`) |
| `ENGRAM_BIN` | path to the Engram binary if it is not on `PATH` |
| `GRU_AWESOME_COPILOT_PATH` | alternative path to the awesome-copilot catalog |
| `GRU_DEEPAGENTS_ENTRY` | path to the deepagents executable adapter (`node adapter.mjs run "prompt"`) |
| `GRU_POSTINSTALL_CONTEXT` | `dev` \| `global` — forces the postinstall context (testing) |

---

## Harness abstraction

Gru runs in different environments without hardcoding models or providers:

- **`host-managed`**: the active harness (Claude Code, Codex, Gemini, Pi) manages the model
  and the tools natively.
- **`sdk-managed`**: standalone mode; it connects to an LLM API via environment variables.

Each environment declares its capabilities (`native-subagents`, `file-tools`, `web-search`,
`code-execution`, `memory`, `approval-flow`) through the `HarnessAdapter` contract.
Level ≥ 3 tasks require `native-subagents`; if the harness does not support it, they are blocked.

---

## Workflows by level

Tasks are classified from Level 0 (trivial) to Level 4 (critical) by complexity + risk.
Each level defines which providers/roles take part:

```text
Level 0  local
Level 1  local → light validation
Level 2  scan → gentlePi (mini-spec) → local → tests → devil → engram
Level 3  scan → gentlePi (SDD) → devil → local → tests → ecc → engram
Level 4  all of the above + double human approval
```

Rules the harness applies on its own:

- **Mandatory skill check**: before each task it looks for a local skill; if none exists,
  it queries the awesome-copilot catalog (search-only).
- **Mandatory delegation**: reading 4+ files, writing to 2+ files, or long sessions →
  sub-agent, not monolithic work.
- **Mandatory reviewer** before commit/push.
- **Personas**: `caveman` compresses the conversation (never the artifacts: JSON/YAML/code
  pass through intact) and `devilsAdvocate` questions and can veto delegations.

---

## Tests

```bash
pnpm test                                          # full suite
pnpm vitest run tests/guardrails.stress.test.ts    # only guardrail stress tests
```

The guardrails suite verifies the orchestrator does not step out of line: destructive ES/EN
prompts, adversarial prompts (injection, urgency, "my boss already approved"), risk buried
in long prompts, false positives, and the `StrictHarnessController` contract.

---

## Troubleshooting

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| `[BLOCKED] Provider 'X' no disponible` | the binary is not installed | follow the hint in the message (see the providers table) |
| `[APROBACIÓN REQUERIDA] Nivel N` | the task touches real risk | answer `si` to approve, or cancel |
| exit code 2 in CI | approval gate or missing provider in strict mode | correct behavior: the strict runtime never simulates |
| `gru status` marks engram `MISSING` | binary outside `PATH` | set `ENGRAM_BIN` |
| awesomeCopilot `CATÁLOGO AUSENTE` | the catalog clone is missing | `gru init --awesome-copilot` (or set `GRU_AWESOME_COPILOT_PATH`) |

More detail: [STRICT_PROVIDER_RUNTIME.md](../../STRICT_PROVIDER_RUNTIME.md) ·
[docs/harness-reference.md](../../docs/harness-reference.md)

---

## Development / contributing

The `@adrichdev/gru-harness` package lives in a pnpm monorepo and is **private** (not
published to the public npm registry; distributed via Git install). To work on the code,
clone the repo, `pnpm install`, and use `pnpm gru ...` (via `tsx`). Details in the private
repository: <https://github.com/AdrichDev/gru_orchestrator>.
