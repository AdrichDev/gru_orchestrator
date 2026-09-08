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

# Gru Harness — 使用指南（参考）

`gru` CLI 的完整参考（包 `@adrichdev/gru-harness`，私有仓库——从 Git 安装，而非公共
registry）。项目概览见 [README.md](../../README.md)。严格 provider 运行时见
[STRICT_PROVIDER_RUNTIME.md](../../STRICT_PROVIDER_RUNTIME.md)。

---

## harness 在哪里运行，需要复制什么？

使用 Gru 有**两种方式**，答案取决于你用哪一种。不要混用。

### A) `gru` CLI（独立）

- **全局安装一次**（`pnpm add -g github:AdrichDev/gru_orchestrator`），它在整个系统暴露
  `gru` 命令。
- 你**不需要**待在 gru_orchestrator 文件夹里。那个仓库只用于*开发* harness。要*使用*它，
  你在**你自己项目的根目录**（你正在工作的项目）运行 `gru`。
- `cwd` 决定：配置作用域（`<cwd>/.gru/`）、filesystem scan 的目标，以及日志
  （`runs/run_*.json`）。所以在你项目的根目录运行，而不是在 gru 的目录。
- **要复制规范文件吗？** 要让 CLI *启动*，不需要：`postinstall` 会播种 `~/.gru/*`，这就够了。
  只有当你想要项目级配置、契约或本地 `.mcp.json` 时，才需要在你的项目里运行 `gru init`。

### B) LLM harness 内的人格（Claude Code、Codex、Gemini、Cursor……）

- 这些工具**从 `cwd` 树**自动加载它们的规范文件：Claude Code 读 `CLAUDE.md`；
  Codex/Cursor/Antigravity 读 `AGENTS.md`；Gemini 读 `GEMINI.md`。
- **这里你确实需要把规范文件放在你自己项目的根目录。** gru 仓库的文件**不够用**：它们只在你
  *在* `gru_orchestrator` *里面*工作时才加载。其他项目不会读取一个陌生仓库的
  `CLAUDE.md`/`AGENTS.md`。
- 要在你的项目里播种它们：`gru init --runtime <tool>`（见
  [`gru init`](#gru-init--完整参考)）。它会写入所选 runtime 的规范文件，外加共享文件
  （`.gru/*`、契约、`.mcp.json`）。

### 小结

| 问题 | 答案 |
| :--- | :--- |
| 要待在 gru 文件夹里吗？ | **不。** 只在开发 harness 时。要使用它，从你项目的根目录运行。 |
| 在哪里运行 `gru`？ | 在**你正在工作的项目根目录**（`cwd` 决定配置/扫描/日志）。 |
| gru 仓库的文件够吗？ | **CLI：** 够（全局 + `~/.gru/`）。**LLM 人格：** 不够——每个工具只读取它自己 `cwd` 树里的规范文件。 |
| 需要把规范文件复制到项目根目录吗？ | **只为 LLM 人格。** 使用 `gru init --runtime <tool>`。CLI 启动不需要它。 |

---

## 安装

```bash
# 私有仓库 → 直接从 Git 安装（无需手动 clone；暴露 `gru` 命令）。
pnpm add -g github:AdrichDev/gru_orchestrator
# 或通过 SSH：
pnpm add -g git+ssh://git@github.com/AdrichDev/gru_orchestrator.git
```

需要访问私有仓库、**git** 和 **Node.js 20+**。安装会在你的机器上编译 bundle（`prepare`
脚本 → tsup）。不发布到公共 npm registry。

### `postinstall` 做什么

全局安装后，bootstrap（`scripts/postinstall.mjs`）**永远不会让安装失败**（总是以代码 0 退出），并：

1. 创建 `~/.gru/`（幂等）。
2. 从 `templates/.gru/` 播种默认 YAML（config、providers、skills），不覆盖已有内容。
3. 打印提示：**awesome-copilot 目录是 opt-in 的**——这里**不**下载。要下载，使用
   `gru init --awesome-copilot`。

在 monorepo 上下文（源码 checkout）中，它委托给 cybersec harness 的校验，而不是全局 bootstrap。

---

## 命令

```bash
gru "<prompt>"                       # 编排一个任务：分类 → 路由 → 执行
gru status                           # provider 的真实状态（别名：doctor、/status）
gru --agentic "<prompt>"             # agentic 流水线：executor → reviewer → tester + gates
gru --agentic "<prompt>" --phase apply --sdd my-change
gru init [选项]                       # 多 runtime 脚手架（见下文）
```

不带参数运行 `gru` 会打印使用帮助。

### `gru "<prompt>"`

端到端编排一个任务：

```text
1. classifyTask()      → 级别 0-4 + 风险信号（双语 ES/EN）
2. 审批 gate           → 若有风险："批准执行吗？(si/NO)"
3. routeTask()         → 按关键词选择 provider（gentlePi、ecc、engram...）
4. Devil's Advocate    → 飞行前否决（provider 缺失、把目录当 executor）
5. 真实健康检查         → 若 provider 未安装：BLOCKED + 如何安装
6. 真实执行            → 结果 + runs/run_*.json 中的可审计日志
```

**人类审批 gate**

- 在交互式终端：Gru 询问 `批准执行此任务吗？(si/NO)`，只有明确的 `si`/`sí` 才会继续。
- 在 CI / 非 TTY：任务**不会执行**，进程以**退出码 2** 结束。
- 在 prompt 里写"已经批准了"或"这只是个测试"**不算作批准**——gate 只接受显式通道。
- 每次执行都记录在 `runs/run_*.json`，包含分类、级别、provider、命令、退出码，以及是否有人类审批。

**Provider 回退**：若所选 provider 不可用但有已安装的替代项，在 TTY 下 Gru 会让你选一个。
在非 TTY 下：退出码 2，不模拟任何东西。

### `gru status`

打印一张表，显示每个 connector 的真实状态（别名：`doctor`、`/status`、`/doctor`）。
每行显示 provider、kind、状态、可执行文件、版本和原因。

| 状态 | 含义 |
| :--- | :--- |
| `READY` | provider 可用且已验证 |
| `CONFIGURADO` | 通过配置可用（`status: configured`） |
| `MISSING` | 必需但未安装 → 出现在"必需操作"中 |
| `INCOMPATIBLE` | 已安装但版本不兼容 |
| `DISABLED (opcional)` | `providers.yaml` 中 `enabled: false`（信息性） |
| `HOST-MANAGED (PENDIENTE)` | sdk provider，其宿主适配器尚未激活 |
| `OPCIONAL (no configurado)` | 可选 sdk provider，未配置 |
| `CATÁLOGO AUSENTE` | 目录（awesomeCopilot）未克隆 |

只有真正必需-但-缺失的 provider 才会出现在"必需操作"中。`DISABLED`、`HOST-MANAGED
(PENDIENTE)` 和 `OPCIONAL` 是信息性的，会被排除。

```bash
gru status --strict     # CI：若缺少任何必需 provider，退出码 2
```

### `gru --agentic`

带 gates 的 agentic 流水线：executor → reviewer → tester。打印 `APROBADO ✓` 或
`RECHAZADO ✗`、blockers 以及每个 gate 的状态。若未通过 → 退出码 2。

```bash
gru --agentic "<prompt>"
gru --agentic "<prompt>" --phase apply --sdd my-change
```

- `--phase <phase>`：SDD 阶段（默认 `apply`）。
- `--sdd <id>`：SDD 变更 id（默认 `current`）。

---

## `gru init` — 完整参考

把 harness 文件脚手架到一个项目中。多 runtime：**只**写入所选 runtime 的文件，外加共享文件。

```bash
gru init                                   # 交互式菜单：runtime + scope
gru init --runtime claude,cursor           # 不询问 runtime
gru init --runtime all --scope project     # 在本仓库使用全部 runtime
gru init --awesome-copilot                 # 同时下载 skills 目录
```

### Flags

| Flag | 取值 | 效果 |
| :--- | :--- | :--- |
| `--runtime` | `claude,codex,gemini,opencode,cursor,antigravity`（CSV）或 `all` | 要脚手架的 runtime。非 TTY 默认：`claude`。TTY 默认：多选菜单。 |
| `--scope` | `project` \| `global` | `project` 写入 `<cwd>/.gru/` 和 `<cwd>/`；`global` 只写入 `~/.gru/`。非 TTY 默认：`project`。若 `<cwd>/.gru/` 已存在则推断为 `project`。 |
| `--force` | — | 覆盖已有文件。覆盖前先保存 `.bak`。在 TTY 下会列出文件并要求输入 `yes` 确认。 |
| `--awesome-copilot` / `--skills` | — | 下载 awesome-copilot 目录（~100MB）到 `~/.gru/awesome-copilot`。Opt-in。 |

重新运行 `gru init` 是幂等的：除非加 `--force`，已有文件会被跳过。若未传 `--awesome-copilot`
且有 TTY，会询问（默认否）。

### 每个 runtime 脚手架什么

| Runtime | 文件 |
| :--- | :--- |
| **claude** | `CLAUDE.md`、`.claude/CLAUDE.md`、`.claude/agents/cybersec/*`、`.claude/skills/*`（cybersec-audit、redteam-attack、blueteam-defense、threat-modeling、purple-loop）、`.atl/skill-registry.md` |
| **codex** | `.codex/AGENTS.md`、`AGENTS.md`（根）、`.codex/agents/cybersec/*.toml` |
| **gemini** | `.gemini/GEMINI.md`、`.gemini/agents/cybersec/*.md` |
| **opencode** | `.config/opencode/AGENTS.md`、`.config/opencode/opencode.json` |
| **cursor** | `.cursor/rules/gru.mdc`、`AGENTS.md`（根） |
| **antigravity** | `AGENTS.md`（根） |
| **共享（始终）** | `.gru/config.yaml`、`.gru/providers.yaml`、`.gru/skills.yaml`、`minion-contract.md`、`cybersec-minion-contract.md`、`.mcp.json` |

根目录的 `AGENTS.md` 由 codex/cursor/antigravity 共享：按目标去重（只写一次）。使用
`--scope global` 时，标记为 project-only 的文件（契约、`.mcp.json`、runtime 文件）不写入；
只把共享的 `.gru/*` 播种到 `~/.gru/`。

`.mcp.json` 注册 **context7** 和 **engram** 的 MCP 服务器。
把 `ENGRAM_BIN` 调整为你的本地路径。

---

## Providers / connectors

Gru 不产出工件：它委托给专门的 provider。目录：

| Provider ID | 可执行文件 / 命令 | 角色 | 外部 | 安装提示 |
| :--- | :--- | :--- | :--- | :--- |
| **local** | 直接命令 | 本地 workspace 任务（filesystem、git、npm、tests）。 | 否 | — |
| **gentlePi** | `gentle-ai`/`pi` | SDD/OpenSpec 规范与有纪律的 TDD。 | 是 | `pi install npm:gentle-pi`（需要 `pi`） |
| **gentlemanCli** | `gentle-ai` | 环境诊断、skill 更新与 sync。 | 是 | 官方安装器（macOS/Linux）；Windows：手动或 WSL |
| **ecc** | `ecc` | 安全审计、策略与 CVE 检测。 | 是 | `pnpm add -D ecc-universal` |
| **deepagents** | 自有适配器 | 带 checkpoint 的长期持久化工作流。 | 是 | 设置 `GRU_DEEPAGENTS_ENTRY` 指向你的适配器 |
| **engram** | `engram` | 决策与上下文的持久化 memory。 | 是 | `pi install npm:gentle-engram` 或设置 `ENGRAM_BIN` |
| **awesomeCopilot** | 本地目录 | 搜索社区 skills（`SKILL.md`）。**只有目录：从不执行。** | 是 | `gru init --awesome-copilot` 或设置 `GRU_AWESOME_COPILOT_PATH` |

**严格运行时**：Gru **从不模拟响应**。若必需的 provider 未安装，它会阻塞任务（`[BLOCKED]`）
并显示安装的确切提示。见 [STRICT_PROVIDER_RUNTIME.md](../../STRICT_PROVIDER_RUNTIME.md)。

**awesome-copilot 是 search-only 的**：harness 搜索目录并**只读取匹配的 `SKILL.md`**——
从不把目录当作 provider 执行。

### 真实路由示例

| Prompt | 级别 | 询问？ | Provider |
| :--- | :--- | :--- | :--- |
| `为新 API 生成 openspec sdd` | 0 | 否 | gentlePi |
| `记住我们决定使用无会话的 JWT` | 0 | 否 | engram |
| `在目录中搜索一个 code review skill` | 0 | 否 | awesomeCopilot |
| `审计安全并审查 CVE` | 2 | **是** | ecc |
| `删除生产数据库` | 4 | **是** | 未批准则阻塞 |

---

## Devil's Advocate — 严格度等级

Devil's Advocate 在 provider 执行前审查每一次委托。它有**硬规则**（总是阻塞）和一条**软规则**
（路由置信度，可配置）。

### 硬规则——无论级别始终激活

| 规则 | 效果 |
| :--- | :--- |
| Provider 不可用 | BLOCKED——Gru 从不模拟执行。 |
| `catalog` 类型的 provider 带执行意图 | BLOCKED——目录是 search-only 的。 |

### 软规则——由 `devil.rigidity` 管控

| 等级 | 行为 |
| :--- | :--- |
| `advisory` | 从不因低置信度警告或阻塞。只有硬规则激活。 |
| `strict` | **（默认）** 当置信度 < `minConfidence`（默认 30%）时警告。从不因置信度阻塞。完全复现之前的行为——缺少配置时完全一致。 |
| `paranoid` | 当置信度 < `max(minConfidence, 60)` 时警告；当置信度 < `minConfidence` 时**阻塞**。消息会要求显式确认 provider。 |

### 在 `.gru/config.yaml` 中配置

```yaml
devil:
  rigidity: strict        # advisory | strict | paranoid（默认：strict）
  minConfidence: 30       # 置信度阈值 %（默认：30）
```

缺少配置或缺少 `devil` 段 = `strict` 行为且 `minConfidence 30`（完全向后兼容）。

---

## 环境变量

| 变量 | 用途 |
| :--- | :--- |
| `GRU_CONFIG_DIR` | 配置目录的替代路径（默认 `~/.gru` 或 `<cwd>/.gru`） |
| `GRU_RUNS_DIR` | 执行日志的替代路径（`runs/run_*.json`） |
| `ENGRAM_BIN` | Engram 二进制的路径（若不在 `PATH` 中） |
| `GRU_AWESOME_COPILOT_PATH` | awesome-copilot 目录的替代路径 |
| `GRU_DEEPAGENTS_ENTRY` | deepagents 可执行适配器的路径（`node adapter.mjs run "prompt"`） |
| `GRU_POSTINSTALL_CONTEXT` | `dev` \| `global`——强制 postinstall 上下文（测试用） |

---

## harness 抽象

Gru 在不同环境中运行，不硬编码模型或 provider：

- **`host-managed`**：活动的 harness（Claude Code、Codex、Gemini、Pi）原生管理模型和工具。
- **`sdk-managed`**：独立模式；通过环境变量连接到某个 LLM 的 API。

每个环境通过 `HarnessAdapter` 契约声明其能力（`native-subagents`、`file-tools`、
`web-search`、`code-execution`、`memory`、`approval-flow`）。级别 ≥ 3 的任务需要
`native-subagents`；若 harness 不支持，则被阻塞。

---

## 按级别的工作流

任务按复杂度 + 风险从级别 0（trivial）到级别 4（critical）分类。每个级别定义哪些
provider/角色参与：

```text
级别 0  local
级别 1  local → 轻量校验
级别 2  scan → gentlePi (mini-spec) → local → tests → devil → engram
级别 3  scan → gentlePi (SDD) → devil → local → tests → ecc → engram
级别 4  以上全部 + 双重人类审批
```

harness 自动应用的规则：

- **强制 skill check**：每个任务前先找本地 skill；若不存在，查询 awesome-copilot 目录
  （search-only）。
- **强制委托**：读 4+ 文件、写 2+ 文件或长会话 → 子 agent，而非单体作业。
- **强制 reviewer**：commit/push 之前。
- **人格**：`caveman` 压缩对话（从不压缩工件：JSON/YAML/代码原样通过），`devilsAdvocate`
  质疑并可对委托行使否决权。

---

## 测试

```bash
pnpm test                                          # 完整套件
pnpm vitest run tests/guardrails.stress.test.ts    # 仅 guardrail 压力测试
```

guardrails 套件验证编排器不越界：ES/EN 破坏性 prompt、对抗性 prompt（注入、紧迫感、
"我老板已经批准了"）、埋在长 prompt 里的风险、误报，以及 `StrictHarnessController` 契约。

---

## 故障排查

| 症状 | 原因 | 解决 |
| :--- | :--- | :--- |
| `[BLOCKED] Provider 'X' no disponible` | 二进制未安装 | 按消息中的提示操作（见 providers 表） |
| `[APROBACIÓN REQUERIDA] Nivel N` | 任务触及真实风险 | 回答 `si` 批准，或取消 |
| CI 中退出码 2 | 严格模式下的审批 gate 或缺失 provider | 正确行为：严格运行时从不模拟 |
| `gru status` 标记 engram 为 `MISSING` | 二进制不在 `PATH` 中 | 设置 `ENGRAM_BIN` |
| awesomeCopilot `CATÁLOGO AUSENTE` | 缺少目录克隆 | `gru init --awesome-copilot`（或设置 `GRU_AWESOME_COPILOT_PATH`） |

更多细节：[STRICT_PROVIDER_RUNTIME.md](../../STRICT_PROVIDER_RUNTIME.md) ·
[docs/harness-reference.md](../../docs/harness-reference.md)

---

## 开发 / 贡献

`@adrichdev/gru-harness` 包位于一个 pnpm monorepo 中，且是**私有的**（不发布到公共 npm
registry；通过 Git install 分发）。要在代码上工作，clone 仓库、`pnpm install`，并使用
`pnpm gru ...`（通过 `tsx`）。细节见私有仓库：<https://github.com/AdrichDev/gru_orchestrator>。
