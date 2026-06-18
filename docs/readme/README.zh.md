<div align="center">

```text
 ██████╗ ██████╗ ██╗   ██╗
██╔════╝ ██╔══██╗██║   ██║
██║  ███╗██████╔╝██║   ██║
██║   ██║██╔══██╗██║   ██║
╚██████╔╝██║  ██║╚██████╔╝   H A R N E S S
 ╚═════╝ ╚═╝  ╚═╝ ╚═════╝

  orchestrator · installable globally · gru init → pick your runtime
```

</div>

> **"Gru coordinates. Minions produce. Policies govern. Human approves."**

---

<div align="center">

🇪🇸 [**Español**](../../README.md) &nbsp;|&nbsp; 🇺🇸 [**English**](README.en.md) &nbsp;|&nbsp; 🇨🇳 [**中文**](README.zh.md) &nbsp;|&nbsp; 🇫🇷 [**Français**](README.fr.md) &nbsp;|&nbsp; 🇩🇪 [**Deutsch**](README.de.md)

</div>

---

## 🚀 安装与配置

请按照以下步骤克隆并安装 **Gru Harness** 开发环境：

### 1. 克隆仓库
```bash
git clone https://github.com/AdrichDev/gru_orchestrator.git
cd gru_orchestrator
```

### 2. 安装项目依赖
本项目是使用 **pnpm** 管理的 monorepo：
```bash
pnpm install
```

### 3. 安装全局必需的 Providers
如果您没有进行编排所需的外部二进制文件，请运行以下命令进行安装：

* **ruflo**（多智能体构建与编排）：
  ```bash
  npm install -g ruflo
  ```
* **gentlePi / gentlemanCli**（规范、SDD 和环境环境）：
  ```bash
  npm install -g @gentle-ai/pi
  ```
* **engram**（语义和持久化内存）：
  从其官方渠道安装二进制文件，并确保其在您的 `PATH` 环境变量中可用或在 `ENGRAM_BIN` 中配置。

---

## 🧠 什么是 Gru Harness？

Gru 是一个编排器和架构师，旨在为软件开发集中决策、评估风险并协调子智能体（minions）。

### 核心原则
* **Gru 不直接编写代码**：Gru 分析结构，在 `implementation_plan.md` 中设计计划，并将产品编写委托给专用的 minions。
* **文件系统扫描**：在做出任何设计决策或对任务进行分类之前，将执行仓库分析以映射依赖关系和风险。
* **基于级别的流**：任务从级别 0（琐碎）到级别 4（关键）进行分类，并根据其风险级别应用特定的审批流程。

---

## 🎛️ Harness 运行时抽象 (Harness Runtime Abstraction)

Gru 使用抽象层运行于不同的执行环境（*Harnesses*）中，而无需在核心代码中硬编码任何 LLM 模型或提供商。

### 执行模式
* **`host-managed`**（宿主托管）：活动的 Harness（如 Claude Code, Codex, Gemini, Pi）直接管理本地模型和工具的执行。系统不会为 LLM 开启任何二次 SDK 连接。
* **`sdk-managed`**（SDK 托管）：自主执行模式（`standalone`）。使用配置的提供商环境变量（如 `GRU_DEEPAGENTS_PROVIDER`, `GRU_DEEPAGENTS_API_KEY_ENV` 等）直接连接到 LLM 的 API。

### 执行流
```text
pnpm gru "prompt"
        ↓
HarnessDetector.detect()            ← 识别当前活动的执行环境
        ↓
AdapterRegistry.get(harnessId)      ← 解析对应的 HarnessAdapter
        ↓
adapter.supports(requiredCapability)?
   ├── 是 → adapter.execute(task)      ← 针对该环境优化的原生执行
   └── 否 → fallbackSequentially()    ← Gru 核心的顺序执行备用方案
        ↓
GruResult → 系统控制台
```

### 能力矩阵 (`GruCapability`)
每个执行环境通过 `HarnessAdapter` 契约动态声明其支持的能力：
* **`native-subagents`**：原生启动子智能体的能力，无需消耗主进程的 token（例如 Claude Code）。
* **`file-tools`**：内置的文件读写工具。
* **`web-search`**：由宿主提供的互联网搜索或网页浏览能力。
* **`code-execution`**：代码执行沙箱或安全运行时环境。
* **`memory`**：长期上下文和内存的持久化能力。
* **`approval-flow`**：请求和授予权限的交互式审批流。

### 规范同步 (`pnpm gru sync`)
Gru 的规则、工作流和技能统一在其原生结构中进行集中管理。运行同步命令时：
1. 读取 `gru/skills/`、`gru/workflows/` 和 `gru/policies/`。
2. 幂等地将其编译并分发到特定的执行环境目录中：`.claude/`、`.codex/`、`.gemini/` 和 `.pi/`。
3. 系统会在覆盖前展示修改差异（diff），除非使用 `--force` 标记，否则将保护手动编辑的文件。

---

## 🔌 Providers 目录

Gru 使用基于 **Providers** 的模块化架构来与环境交互并执行委托的任务：

| Provider ID | 可执行文件 / 命令 | 角色与职责 |
| :--- | :--- | :--- |
| **`local`** | 直接命令 | 在工作区中执行本地任务（文件系统、git、npm、测试）。 |
| **`ruflo`** | `ruflo` | 用于复杂任务 and 并行 minion swarms 的多智能体编排器。 |
| **`gentlePi`** | `gentle-ai/pi` | 用于 SDD/OpenSpec 方法下的系统规范支持和工具。 |
| **`gentlemanCli`** | `gentle-ai` | 环境诊断、技能更新和状态同步。 |
| **`ecc`** | `ecc` | 安全策略审计、代码分析和 CVE 漏洞检测。 |
| **`deepagents`** | `deepagents` | 长期工作流和持久任务线程。 |
| **`engram`** | `engram` | 访问决策持久内存和项目的历史上下文。 |
| **`awesomeCopilot`** | 本地目录 | 在社区仓库中搜索技能（`SKILL.md`）和模板。 |
