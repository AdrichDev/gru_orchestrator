# 💻 GRU ORCHESTRATOR

```text
 ██████╗ ██████╗ ██╗   ██╗     ██████╗ ██████╗  ██████╗██╗  ██╗███████╗███████╗████████╗██████╗  █████╗ ████████╗ ██████╗ ██████╗ 
██╔════╝ ██╔══██╗██║   ██║    ██╔═══██╗██╔══██╗██╔════╝██║  ██║██╔════╝██╔════╝╚══██╔══╝██╔══██╗██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗
██║  ███╗██████╔╝██║   ██║    ██║   ██║██████╔╝██║     ███████║█████╗  ███████╗   ██║   ██████╔╝███████║   ██║   ██║   ██║██████╔╝
██║   ██║██╔══██╗██║   ██║    ██║   ██║██╔══██╗██║     ██╔══██║██╔══╝  ╚════██║   ██║   ██╔══██╗██╔══██║   ██║   ██║   ██║██╔══██╗
╚██████╔╝██║  ██║╚██████╔╝    ╚██████╔╝██║  ██║╚██████╗██║  ██║███████╗███████║   ██║   ██║  ██║██║  ██║   ██║   ╚██████╔╝██║  ██║
 ╚═════╝ ╚═╝  ╚═╝ ╚═════╝      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝
```

> **"Gru coordinates. Minions produce. Policies govern. Human approves."**

---

### 🌐 Idiomas / Languages / 语言 / Langues / Sprachen

* 🇪🇸 **[Español](../../README.md)**
* 🇺🇸 **[English](README.en.md)**
* 🇨🇳 **[中文](README.zh.md)**
* 🇫🇷 **[Français](README.fr.md)**
* 🇩🇪 **[Deutsch](README.de.md)**

---

## 🚀 Installation & Setup

Follow these steps to clone and install the **Gru Orchestrator** development environment:

### 1. Clone the repository
```bash
git clone https://github.com/AdrichDev/gru_orchestrator.git
cd gru_orchestrator
```

### 2. Install project dependencies
This project is a monorepo managed with **pnpm**:
```bash
pnpm install
```

### 3. Install required global Providers
If you do not have the external binaries required for orchestration, install them by running:

* **ruflo** (Multi-agent building and orchestration):
  ```bash
  npm install -g ruflo
  ```
* **gentlePi / gentlemanCli** (Specification, SDD, and environment):
  ```bash
  npm install -g @gentle-ai/pi
  ```
* **engram** (Semantic and persistent memory):
  Install the binary from its official channel and ensure it is available in your `PATH` environment variable or configured in `ENGRAM_BIN`.

---

## 🧠 What is Gru Orchestrator?

Gru is an orchestrator and architect designed to centralize decision-making, assess risks, and coordinate sub-agents (minions) for software development.

### Core Principles
* **Gru does not code directly**: Gru analyzes the structure, designs plans in `implementation_plan.md`, and delegates product writing to specialized minions.
* **Filesystem Scan**: Before making any design decisions or classifying a task, a repository analysis is executed to map dependencies and risks.
* **Level-based Workflows**: Tasks are classified from Level 0 (trivial) to Level 4 (critical), applying specific approval processes based on their risk level.

---

## 🎛️ Harness Runtime Abstraction

Gru utilizes an abstraction layer to run across different execution environments (*harnesses*) without hardcoding LLM models or providers into its core.

### Execution Modes
* **`host-managed`**: The active harness (Claude Code, Codex, Gemini, Pi) directly manages the native model and tool execution. No secondary SDK connection is opened for the LLM.
* **`sdk-managed`**: Autonomous execution mode (`standalone`). Connects directly to an LLM provider's API using configured environment variables (`GRU_DEEPAGENTS_PROVIDER`, `GRU_DEEPAGENTS_API_KEY_ENV`, etc.).

### Execution Flow
```text
pnpm gru "prompt"
        ↓
HarnessDetector.detect()            ← Identifies the active runtime environment
        ↓
AdapterRegistry.get(harnessId)      ← Resolves the corresponding HarnessAdapter
        ↓
adapter.supports(requiredCapability)?
   ├── Yes → adapter.execute(task)     ← Native execution optimized for the environment
   └── No  → fallbackSequentially()    ← Gru Core's sequential execution fallback
        ↓
GruResult → System console
```

### Capabilities Matrix (`GruCapability`)
Each execution environment declares which capabilities it dynamically supports via the `HarnessAdapter` contract:
* **`native-subagents`**: The environment's ability to launch sub-agents natively without consuming token capacity from the main process (e.g., Claude Code).
* **`file-tools`**: Built-in tools for reading and writing files.
* **`web-search`**: Internet search or navigation provided by the host.
* **`code-execution`**: Code execution sandbox or secure runtime environment.
* **`memory`**: Long-term context and memory persistence.
* **`approval-flow`**: Interactive prompt flows for requesting and granting permissions.

### Canonical Synchronization (`pnpm gru sync`)
Gru maintains rules, workflows, and skills centrally in its native structure. When running the synchronization command:
1. It reads from `gru/skills/`, `gru/workflows/`, and `gru/policies/`.
2. It compiles and distributes them idempotently into harness-specific directories: `.claude/`, `.codex/`, `.gemini/`, and `.pi/`.
3. The system presents a diff of the proposed changes before overwriting, protecting manual edits unless the `--force` flag is used.

---

## 🔌 Providers Catalog

Gru uses a modular architecture based on **Providers** to interact with the environment and execute delegated tasks:

| Provider ID | Executable / Command | Role & Responsibility |
| :--- | :--- | :--- |
| **`local`** | Direct command | Execution of local tasks in the workspace (filesystem, git, npm, tests). |
| **`ruflo`** | `ruflo` | Multi-agent orchestrator for complex tasks and parallel minion swarms. |
| **`gentlePi`** | `gentle-ai/pi` | Support and tools for system specification under SDD/OpenSpec methodology. |
| **`gentlemanCli`** | `gentle-ai` | Environment diagnostics, skill updates, and state synchronization. |
| **`ecc`** | `ecc` | Security policy auditing, code analysis, and CVE vulnerability detection. |
| **`deepagents`** | `deepagents` | Long-term workflows and persistent task threads. |
| **`engram`** | `engram` | Access to persistent memory of decisions and historical context of the project. |
| **`awesomeCopilot`** | Local catalog | Search for skills (`SKILL.md`) and templates in the community repository. |
