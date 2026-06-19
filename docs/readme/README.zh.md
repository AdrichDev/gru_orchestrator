<div align="center">

<img src="../assets/gru-banner.svg" alt="GRU Harness — orchestrator" width="640">

</div>

> **"Gru coordinates. Minions produce. Policies govern. Human approves."**

<div align="center">

![Node](https://img.shields.io/badge/node-%3E%3D20-3c873a) ![Runtime](https://img.shields.io/badge/runtime-strict-facc15) ![级别](https://img.shields.io/badge/%E7%BA%A7%E5%88%AB-0--4-64748b) ![Harness](https://img.shields.io/badge/blue%2Fred%2Fpurple-cybersec-8b5cf6)

</div>

---

<div align="center">

🇪🇸 [**Español**](../../README.md) &nbsp;|&nbsp; 🇺🇸 [**English**](README.en.md) &nbsp;|&nbsp; 🇨🇳 [**中文**](README.zh.md) &nbsp;|&nbsp; 🇫🇷 [**Français**](README.fr.md) &nbsp;|&nbsp; 🇩🇪 [**Deutsch**](README.de.md)

</div>

---

## 🧠 什么是 Gru Harness？

Gru 是一个 **LLM 编排 harness**：一个协调层，集中决策、评估每个任务的风险，并将执行委派给专用 provider（Ruflo、Gentle-Pi、ECC、Engram、Awesome Copilot……）。它可运行在 Claude Code、Codex、Gemini CLI、OpenCode、Cursor 或 Antigravity 内部，也可通过 `gru` CLI 独立运行。

### 核心原则

* **Gru 不直接编写代码**：它分析、分类并委派。由 Minion 产出工件。
* **严格运行时**：Gru **从不模拟响应**。如果某个 provider 未安装，它会阻止任务并告诉你如何安装。
* **人工审批门**：任何破坏性、生产、安全、主分支或产生费用的任务都需要你的明确批准。该门是双语（ES/EN）的，无法通过 prompt 协商绕过。
* **基于级别的工作流**：任务根据复杂度 + 风险决策表从 0 级（琐碎）分类到 4 级（关键）。

---

## 🧩 Minion 与 Provider

两个不同的概念，**不可**互换：

* **Minion** —— 被委派的*角色*（builder、reviewer、architect、tester、security、devil、pm、docs、filesystem、context7、memory、mcp）。它是 Gru 委派的**工作单元**。共 13 个角色，每个职责单一。
* **Provider** —— 执行*后端*（`local`、`ruflo`、`gentlePi`、`gentlemanCli`、`ecc`、`deepagents`、`engram`、`awesomeCopilot`）。它是执行 Minion 工作的**运行时**。

> Minion 是角色（ROLE）。Provider 是后端（BACKEND）。Gru 根据级别和任务类型选择两者。

---

## 📊 任务级别

Gru 对每个任务评分（复杂度 + 风险）并在行动前分类：

| 级别 | 名称 | 工作流（摘要） |
|:---:|---|---|
| **0** | 琐碎 | `local` |
| **1** | 小 | `local` + devil/caveman |
| **2** | 中 | 轻量 architect → mini-spec → builder → tester → reviewer |
| **3** | 大 | architect → devil → spec → 按单元 builder → tester → security → reviewer |
| **4** | 关键 | + Ruflo CONSULT + **人工审批** + 独立 reviewer |

分类前**必须**执行 **Filesystem Scan**。仓库证据可以提升级别，但没有证据绝不降低。

---

## 🚀 快速开始

```bash
pnpm add -g github:AdrichDev/gru_orchestrator   # 安装 `gru`（私有仓库，Node 20+）
cd your-project
gru init                    # 交互式菜单：选择 runtime + scope
gru status                  # 每个 provider 的真实状态
gru "<prompt>"              # 编排任务：分类 → 路由 → 执行
```

`postinstall` 会以默认配置准备 `~/.gru/`。awesome-copilot 目录是 **opt-in**
（`gru init --awesome-copilot`），不会自动下载。

---

## ⌨️ 命令

```bash
gru "<prompt>"                       # 编排：分类 → 门 → 路由 → 执行
gru status                           # provider 真实状态（别名：doctor、/status）
gru status --strict                  # CI：缺少必需 provider 时退出码 2
gru --agentic "<prompt>"             # agentic 流水线：executor → reviewer → tester + 门
gru --agentic "<prompt>" --phase apply --sdd my-change
gru init [options]                   # 多 runtime 脚手架
```

每次运行都会记录到 `runs/run_*.json`（分类、级别、provider、退出码以及是否有人工审批）。
在 CI / 非 TTY 环境下，有风险的任务**不会执行**：以退出码 2 终止——绝不模拟。

---

## 🔌 Providers

Gru 委派给专用 provider：`local`、`ruflo`、`gentlePi`、`gentlemanCli`、`ecc`、
`deepagents`、`engram` 和 `awesomeCopilot`（仅搜索目录）。在严格运行时下，缺失的
provider 会阻止任务并给出安装提示——没有静默回退。

---

## 🛡️ 网络安全 harness（Blue / Red / Purple）

对于任何审计、利用、加固或威胁建模的请求，Gru 都会委派给网络安全 minion。攻击性工作
**始终**受 `cybersec-minion-contract.md` 约束（仅授权范围、实验/沙箱、无真实目标）。

| 团队 | Minions |
|---|---|
| 🔴 **RED** | redteam-coordinator · recon · exploit |
| 🔵 **BLUE** | blueteam-coordinator · hardening · detect · incident |
| 🟣 **PURPLE** | purpleteam-coordinator（驱动循环 + 持久化学习成果） |

**循环：** `RECON → EXPLOIT → ASSESS → HARDEN → DETECT → REAUDIT → LEARN → 重复`。
Red 的突破即为 OPEN 发现；Blue 必须修复**并**添加检测以将其关闭。
只要还有 OPEN 发现，就绝不宣布 `HARDENED`。
→ [docs/cybersec/ATTACK-DEFENSE-PLAYBOOK.md](../cybersec/ATTACK-DEFENSE-PLAYBOOK.md)

---

## 😈 Devil's Advocate

质疑每个决策的否决人格。刚性程度可在 `.gru/config.yaml`（`devil.rigidity`）中配置：

| 级别 | 行为 |
|---|---|
| `advisory` | 警告，不阻止 |
| `strict` *(默认)* | 阻止无理由的风险任务 |
| `paranoid` | 即使中等任务也要求明确批准 |

**硬规则**（破坏性、生产、安全、费用）始终生效，与刚性级别无关。
→ 详见 [USAGE.zh.md](../usage/USAGE.zh.md#devils-advocate--严格度等级)。

---

## 📖 文档

* **[USAGE.zh.md](../usage/USAGE.zh.md)** —— 完整参考：命令、`gru init`、provider、环境变量和故障排查。
* **[STRICT_PROVIDER_RUNTIME.md](../../STRICT_PROVIDER_RUNTIME.md)** —— 严格的 provider 运行时。
* **[SDD.md](../../SDD.md)** —— 规范驱动开发：阶段、持久化和 Engram 格式。
* **[docs/harness-reference.md](../harness-reference.md)** —— provider 目录、人格、工作流和项目接入。
* **[docs/cybersec/ATTACK-DEFENSE-PLAYBOOK.md](../cybersec/ATTACK-DEFENSE-PLAYBOOK.md)** —— red/blue/purple 手册。

开发 / 贡献：克隆仓库，`pnpm install`，并使用 `pnpm gru ...` ——
<https://github.com/AdrichDev/gru_orchestrator>。
