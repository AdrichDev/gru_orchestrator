<div align="center">

<img src="../assets/gru-banner.svg" alt="GRU Harness — orchestrator" width="640">

</div>

> **"Gru coordinates. Minions produce. Policies govern. Human approves."**

<div align="center">

![Node](https://img.shields.io/badge/node-%3E%3D20-3c873a) ![Runtime](https://img.shields.io/badge/runtime-strict-facc15) ![Levels](https://img.shields.io/badge/levels-0--4-64748b) ![Harness](https://img.shields.io/badge/blue%2Fred%2Fpurple-cybersec-8b5cf6)

</div>

---

<div align="center">

🇪🇸 [**Español**](../../README.md) &nbsp;|&nbsp; 🇺🇸 [**English**](README.en.md) &nbsp;|&nbsp; 🇨🇳 [**中文**](README.zh.md) &nbsp;|&nbsp; 🇫🇷 [**Français**](README.fr.md) &nbsp;|&nbsp; 🇩🇪 [**Deutsch**](README.de.md)

</div>

---

## 🧠 What is Gru Harness?

Gru is an **LLM orchestrator harness**: a coordination layer that centralizes decision-making, scores the risk of every task, and delegates execution to specialized providers (Gentle-Pi, ECC, Engram, Awesome Copilot…). It runs inside Claude Code, Codex, Gemini CLI, OpenCode, Cursor, or Antigravity — or standalone via the `gru` CLI.

### Core principles

* **Gru does not code directly**: it analyzes, classifies, and delegates. Minions produce the artifacts.
* **Strict runtime**: Gru **never simulates responses**. If a provider is not installed, it blocks the task and tells you how to install it.
* **Human approval gate**: every destructive, production, security, main-branch, or cost-incurring task requires your explicit approval. The gate is bilingual (ES/EN) and cannot be negotiated via prompt.
* **Level-based workflows**: tasks are classified from Level 0 (trivial) to Level 4 (critical) via a complexity + risk decision table.

---

## 🧩 Minions vs Providers

Two distinct concepts, **not** interchangeable:

* **Minion** — a delegated *role* (builder, reviewer, architect, tester, security, devil, pm, docs, filesystem, context7, memory, mcp). It is the **unit of work** Gru delegates. 13 roles, each with a single responsibility.
* **Provider** — an execution *backend* (`local`, `gentlePi`, `gentlemanCli`, `ecc`, `deepagents`, `engram`, `awesomeCopilot`). It is the **runtime** that carries out the Minion's work.

> A Minion is a ROLE. A Provider is a BACKEND. Gru picks both based on level and task type.

---

## 📊 Task levels

Gru scores every task (complexity + risk) and classifies it before acting:

| Level | Name | Workflow (summary) |
|:---:|---|---|
| **0** | Trivial | `local` |
| **1** | Small | `local` + devil/caveman |
| **2** | Medium | light architect → mini-spec → builder → tester → reviewer |
| **3** | Large | architect → devil → spec → builder per unit → tester → security → reviewer |
| **4** | Critical | + **human approval** + independent reviewer |

The **Filesystem Scan** is mandatory before classifying. Repo evidence can raise the level, never lower it without proof.

---

## 🚀 Quickstart

```bash
pnpm add -g github:AdrichDev/gru_orchestrator   # installs `gru` (private repo, Node 20+)
cd your-project
gru init                    # interactive menu: pick runtime(s) + scope
gru status                  # real status of each provider
gru "<prompt>"              # orchestrate a task: classify → route → execute
```

The `postinstall` prepares `~/.gru/` with the default config. The awesome-copilot catalog
is **opt-in** (`gru init --awesome-copilot`); it is not downloaded automatically.

---

## ⌨️ Commands

```bash
gru "<prompt>"                       # orchestrate: classify → gate → route → execute
gru status                           # real provider status (aliases: doctor, /status)
gru status --strict                  # CI: exit code 2 if a required provider is missing
gru --agentic "<prompt>"             # agentic pipeline: executor → reviewer → tester + gates
gru --agentic "<prompt>" --phase apply --sdd my-change
gru init [options]                   # multi-runtime scaffolding
```

Every run is logged to `runs/run_*.json` (classification, level, provider, exit code, and
whether there was human approval). In CI / non-TTY, a risky task **is not executed**: it
exits with code 2 — it never simulates.

---

## 🔌 Providers

Gru delegates to specialized providers: `local`, `gentlePi`, `gentlemanCli`,
`ecc`, `deepagents`, `engram`, and `awesomeCopilot` (search-only catalog). Under the strict
runtime, a missing provider blocks the task with its install hint — no silent fallback.

---

## 🛡️ Cybersecurity harness (Blue / Red / Purple)

On any request to audit, exploit, harden, or threat-model, Gru delegates to cybersecurity
minions. Offensive work is **always** bounded by `cybersec-minion-contract.md` (authorized
scope only, lab/sandbox, no real targets).

| Team | Minions |
|---|---|
| 🔴 **RED** | redteam-coordinator · recon · exploit |
| 🔵 **BLUE** | blueteam-coordinator · hardening · detect · incident |
| 🟣 **PURPLE** | purpleteam-coordinator (drives the loop + persists learnings) |

**Cyclic loop:** `RECON → EXPLOIT → ASSESS → HARDEN → DETECT → REAUDIT → LEARN → repeat`.
A Red breach is an OPEN finding; Blue must fix it **and** add detection to close it.
`HARDENED` is never declared while an OPEN finding remains.
→ [docs/cybersec/ATTACK-DEFENSE-PLAYBOOK.md](../cybersec/ATTACK-DEFENSE-PLAYBOOK.md)

---

## 😈 Devil's Advocate

A veto persona that challenges every decision. Rigidity is configurable in
`.gru/config.yaml` (`devil.rigidity`):

| Level | Behavior |
|---|---|
| `advisory` | warns, does not block |
| `strict` *(default)* | blocks risky tasks without justification |
| `paranoid` | requires explicit approval even on medium tasks |

The **hard rules** (destructive, production, security, cost) are always active, regardless
of the rigidity level. → details in [USAGE.en.md](../usage/USAGE.en.md#devils-advocate--rigidity-levels).

---

## 📖 Documentation

* **[USAGE.en.md](../usage/USAGE.en.md)** — full reference: commands, `gru init`, providers, environment variables, and troubleshooting.
* **[STRICT_PROVIDER_RUNTIME.md](../../STRICT_PROVIDER_RUNTIME.md)** — the strict provider runtime.
* **[SDD.md](../../SDD.md)** — Spec-Driven Development: phases, persistence, and Engram format.
* **[docs/harness-reference.md](../harness-reference.md)** — providers catalog, personas, workflows, and project intake.
* **[docs/cybersec/ATTACK-DEFENSE-PLAYBOOK.md](../cybersec/ATTACK-DEFENSE-PLAYBOOK.md)** — red/blue/purple playbook.

Development / contributing: clone the repo, `pnpm install`, and use `pnpm gru ...` —
<https://github.com/AdrichDev/gru_orchestrator>.
