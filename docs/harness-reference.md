# GRU Harness — Reference (Consult On Demand)

> This file contains explanatory and catalog material extracted from `harness/GRU.md`
> during Slice B of the harness-single-source refactor.
>
> This is a hand-maintained companion document. It is NOT a generated target.
> Source of truth for imperatives: `harness/GRU.md` kernel section.
>
> When to consult this file: when you need the full provider catalog, persona
> definitions, project intake questionnaire, full workflow sequences, or available
> commands. The kernel in `harness/GRU.md` contains back-pointers to each section.

---

## Providers Catalog {#providers-catalog}

| Provider (ProviderId) | Command / Executable | Responsibility and Role |
|---|---|---|
| **local** | Direct command | Execution of local tasks (filesystem, git, npm, tests). |
| **ruflo** | `ruflo` | Multi-agent orchestrator for complex tasks and swarms. |
| **gentlePi** | `gentle-ai/pi` | Support and instrumentation for SDD and OpenSpec workflows. |
| **gentlemanCli** | `gentle-ai` | Environment diagnostics, skill updates, and sync. |
| **ecc** | `ecc` | Policy audit, security review, and CVE. |
| **deepagents** | `deepagents` | Long-term persistent task workflows and chains. |
| **engram** | `engram` | Access to persistent memory and context storage. |
| **awesomeCopilot** | Local catalog | Search for skills and templates in the vendor repository. |

---

## Provider Protocol {#provider-protocol}

> **LSP applied**: every Provider must implement Gru's task execution interface.
> If a provider does not respond or is absent, Gru reports the error and blocks the task.

Each provider must:
- Report availability via `checkAvailability()`.
- Expose their real capabilities and limitations.
- Record the task result (`success`, `output`, `exitCode`, `error`).

### Task Execution Format

Gru invokes providers by passing a structured payload:
- `prompt`: task instructions.
- `taskId`: generated unique identifier.

Providers return:
- `success`: boolean indicating operation success.
- `output` / `rawOutput`: resulting text or data.
- `error`: detailed error message in case of failure.

---

## Core Personas {#core-personas}

Gru's kernel evaluates certain behavioral traits directly during orchestration:

- **devilsAdvocate**: Evaluates prompts and router assignment. Detects risks, blocks unsafe
  executions (like writes outside the workspace), and issues warnings.
- **caveman**: Formats and compresses system outputs into a direct, no-nonsense command
  language.

---

## Minion Catalog {#minion-catalog}

Full catalog of delegated sub-agent roles (Minions). The activation rule and back-pointer
live in `harness/GRU.md#minion-contract`.

| Minion | Unique Responsibility |
|---|---|
| filesystem | Read and map the repo |
| architect | Architecture decisions |
| spec | Write specifications |
| builder | Implement code |
| reviewer | Code review and quality |
| tester | Write and run tests |
| security | Security audit |
| devil | Challenge decisions |
| pm | Manage tasks and issues |
| docs | Documentation |
| context7 | Query technical documentation |
| memory | Manage Engram |
| mcp | Activate and manage MCPs |

Rule: Do not activate a Minion because it exists. Activate it only because the decision
table requires it.

**architect + ADR**: when `architect` records an architectural decision (same signal that
triggers `six-hats-review`), generate an ADR using the template at
`vendor/awesome-copilot/skills/create-architectural-decision-record/SKILL.md` (referenced
by path, not copied). Save it to `docs/adr/<date>-<slug>.md` and link it from the Engram
`architecture:[module]` entry.

**reviewer + quality-playbook**: for changes touching 4+ files, invoke
`vendor/awesome-copilot/skills/quality-playbook/SKILL.md` (referenced by path, Apache-2.0)
as an additional multi-pass review before closing L3/L4 changes. Not used below 4 files —
it is heavy (2700+ lines), reserved for changes where the extra rigor pays off.

---

## Workflows by Level — Full Sequences {#workflow-sequences}

Full provider sequences per level. The kernel in `harness/GRU.md` contains a compact
level→roles summary; this section contains the detailed step-by-step sequences.

### Level 0 — Trivial
```text
local provider (for quick validation)
```

### Level 1 — Small
```text
local provider (filesystem scan in step 0)
→ local provider (for code editing)
→ devilsAdvocate/caveman persona (light validation)
```

Optional: engram/awesomeCopilot provider.

### Level 2 — Medium
```text
local provider (filesystem scan)
→ gentlePi / gentlemanCli provider (for SDD and spec validation)
→ local provider (for code editing)
→ pnpm test (run tests)
→ devilsAdvocate persona (risk assessment)
→ engram provider (if there are persistent decisions)
```

### Level 3 — Large
```text
local provider (filesystem scan)
→ [if "Requires new architecture" or 2+ viable alternatives: six-hats-review skill]
→ gentlePi provider (SDD: specs, tasks, and design)
→ 3c: spec self-check (spec author re-reads spec against Filesystem Scan findings and
       the original problem — coverage gaps, missing scenarios, scope creep)
→ 3d: devil re-check (fresh sub-agent re-reads the WRITTEN spec — not the idea — for
       unjustified alternatives, unlisted risks, "how" disguised as "what"; blocking
       finding → back to spec)
→ devilsAdvocate persona (deep risk assessment)
→ local or ruflo provider (for distributed code implementation)
→ pnpm test (run unit/integration tests)
→ ecc provider (security audit and CVE)
→ engram provider (save architectural decisions)
```

### Level 4 — Critical
```text
local provider (filesystem scan)
→ [if "Requires new architecture" or 2+ viable alternatives: six-hats-review skill]
→ gentlePi provider (complete SDD)
→ 3c: spec self-check
→ 3d: devil re-check (fresh sub-agent; blocking finding → back to spec)
→ devilsAdvocate persona (mandatory audit)
→ ruflo provider (multi-agent coordination in CONSULT/DELEGATE mode)
→ explicit human approval
→ local/ruflo provider (phased implementation and testing)
→ ecc provider (mandatory security)
→ final human approval
→ engram provider (historical record of decisions)
```

---

## Project Intake {#project-intake}

### New Project
- Name, goal, type.
- Stack.
- Repo: GitHub, Bitbucket, or GitLab.
- Management: Jira, Linear, Trello, or Notion.
- Deployment.
- Database.
- AI.
- Available MCPs.
- Autonomy level.

After:
```text
1. Save to Engram.
2. Activate required MCPs.
3. Run /sdd-init if the level requires it.
```

### Existing Project
- Repo path or URL.
- README, dependencies, issues, active branch, conventions, technical debt.

After:
```text
1. Complete Filesystem Scan.
2. Compare with Engram memory.
3. Update context.
4. Classify task.
```

### Context Confidence Level
```text
HIGH   → Repo analyzed or Ruflo read the project.
MEDIUM → User responded, partial memory.
LOW    → Only assumptions.
```

---

## Available Commands {#available-commands}

```text
/sdd-init
/gentle-ai:status
engram search "query"
engram tui
gentle-ai doctor
```
