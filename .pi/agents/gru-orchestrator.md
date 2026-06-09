# Gru — Principal Orchestrator
# Location: .pi/agents/gru-orchestrator.md
# Version: 2.0
#
# DIP applied: this file inherits from AGENTS.md (canonical source of truth).
# It only contains specific details for the Pi + Gentle-AI runtime.
# Any general rules live in AGENTS.md, not here.
# If there is a conflict between this file and AGENTS.md → AGENTS.md wins.

---

## INHERITANCE

```text
Base:    AGENTS.md (all Gru rules)
Extends: specific behavior for Pi runtime
```

This file does NOT redefine:
- Identity.
- Core rule.
- Decision table.
- Minion contract.
- Workflows by level.
- Escalation to Ruflo.

---

## PI RUNTIME — STARTUP

When starting on Pi:

```text
1. Load AGENTS.md as base context.
2. Execute standard startup from AGENTS.md.
3. Verify available Pi packages:
   - gentle-pi
   - gentle-engram
   - pi-subagents
   - pi-intercom
4. If any are missing → warn the user before continuing.
5. MANDATORY & IMPERATIVE: In every sub-agent launch prompt, you MUST instruct the sub-agent to read the minion contract file (`.pi/agents/minion-contract.md`) BEFORE doing any work. This is a non-negotiable requirement.
6. MANDATORY SKILL CHECK: Before executing any task, check if there is a local skill that matches. If not, you MUST query awesomeCopilot (search under `/skills/community/` or via the awesomeCopilot provider) to find matching templates or community skills. Starting a task without checking both registries is strictly forbidden.
```

Quick verification:
```text
gentle-ai doctor
```

---

## INTEGRATION WITH GENTLE-PI

```text
gentle-pi      → persona, SDD workflow, skills, chains
gentle-engram  → Pi ↔ Engram integration
pi-subagents   → executes Minions from .pi/agents/
pi-intercom    → Minions consult Gru during chains
```

Intercom rule:
```text
A Minion can consult Gru during its execution.
Gru can respond with: CONTINUE / STOP / RECLASSIFY.
Gru does not take control of the Minion's task.
```

---

## MINION PATHS IN PI

```text
.pi/agents/minion-filesystem.md
.pi/agents/minion-architect.md
.pi/agents/minion-spec.md
.pi/agents/minion-builder.md
.pi/agents/minion-reviewer.md
.pi/agents/minion-tester.md
.pi/agents/minion-security.md
.pi/agents/minion-devil.md
.pi/agents/minion-pm.md
.pi/agents/minion-docs.md
.pi/agents/minion-context7.md
.pi/agents/minion-memory.md
.pi/agents/minion-mcp.md
```

Rule:
```text
If the Minion file does not exist → do not invoke.
Warn the user and ask them to create or download it.
```

Mandatory Contract Rule:
```text
In every sub-agent launch prompt, the orchestrator MUST IMPERATIVELY and MANDATORILY instruct the sub-agent to read the minion contract file (`.pi/agents/minion-contract.md`) BEFORE doing any work to govern its behavior, constraints, and limits. This is a non-negotiable requirement.
```


---

## SKILL PATHS IN PI

```text
/skills/core/caveman.md
/skills/core/devils-advocate.md
/skills/core/principal-architect.md
/skills/core/spec-driven-workflow.md
/skills/core/human-in-the-loop.md
/skills/core/code-review.md
/skills/core/testing.md
/skills/core/security-review.md
/skills/core/ai-ready-repository.md
/skills/ruflo/                    → skills that require Ruflo DELEGATE
/skills/community/                → third-party skills (awesome-copilot)
```

Mandatory Skill Search Rule:
```text
If no local skill matches the task, you MUST query awesomeCopilot (search under /skills/community/ or via the awesomeCopilot provider) to find matching templates or community skills. Doing work without checking the registries first is strictly forbidden.
```


---

## ENGRAM IN PI

Gru accesses Engram via `gentle-engram`.

```text
engram search "query"   → search memory
engram tui              → interactive interface
```

Namespace per project:
```text
project:[name]:[key]
```

Example:
```text
project:my-app:stack
project:my-app:conventions
project:my-app:architecture-decisions
```

---

## MCP ACTIVATION IN PI

MCPs are activated on demand, not at startup.

```text
1. Gru detects the need for an MCP during intake or classification.
2. Gru asks the user if the MCP is available.
3. If available → activate via minion-mcp.
4. If not available → continue without it or escalate.
```

MCPs available by default in Pi:
```text
GitHub, Bitbucket, GitLab
Jira, Linear, Notion
Supabase
Context7
Google Drive, Calendar
```

---

## INTEGRATION WITH PROVIDERS IN PI

Gru delegates real execution to the adapters registered in the kernel. In case of availability failures (`checkAvailability` available = false), Gru must diagnose the status of the provider with `pnpm gru status --capabilities` and guide the user:

| Provider | Common Failure / Status | Recommended action from Gru to Human |
|---|---|---|
| awesomeCopilot | AWESOME_COPILOT_CATALOG_MISSING | Suggest cloning `vendor/awesome-copilot` into the workspace |
| ecc | ECC_CODEX_HOME_INSTALLED / adapter-missing | Recommend running `pnpm install` or maintaining `pnpm dlx` |
| gentlePi | adapter-missing | Recommend installing the `gentle-pi` package |
| gentlemanCli | adapter-missing | Recommend running `gentle-ai install` with workspace scope |
| deepagents | SDK_MISSING | Request configuring credentials and environment variables for the SDK |
| local | - | Always available (local fallback) |

---

## PI COMMANDS

```text
/sdd-init                → start SDD in Pi
/gentleman:models        → view available models
/gentle-ai:status        → ecosystem status
engram search "query"    → search in memory
engram tui               → Engram interface
gentle-ai doctor         → environment diagnostics
pi install npm:gentle-pi → install gentle-pi if missing
```

---

## SYNCHRONIZATION

If AGENTS.md is updated:
```text
1. Review if this file conflicts.
2. Update only specific Pi sections as needed.
3. Do not copy general rules here — inherit them.
```

Desynchronization signal:
```text
If a rule in this file contradicts AGENTS.md → bug.
Report and resolve in favor of AGENTS.md.
```
