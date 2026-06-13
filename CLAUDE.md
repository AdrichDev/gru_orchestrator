# Ruflo — Claude Code Configuration

## Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — prefer editing existing files
- NEVER create documentation files unless explicitly requested
- NEVER save working files or tests to root — use `/src`, `/tests`, `/docs`, `/config`, `/scripts`
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- NEVER add a `Co-Authored-By` trailer to user commits unless this project's `.claude/settings.json` has `attribution.commit` set (#2078). The Claude Code Bash tool may suggest one in its default commit-message template — ignore it. `Co-Authored-By` is semantic authorship attribution under git/GitHub convention; the tool is the facilitator, not a co-author.
- Keep files under 500 lines
- Validate input at system boundaries

## Agent Comms (SendMessage-First Coordination)

Named agents coordinate via `SendMessage`, not polling or shared state.

```
Lead (you) ←→ architect ←→ developer ←→ tester ←→ reviewer
              (named agents message each other directly)
```

### Spawning a Coordinated Team

```javascript
// ALL agents in ONE message, each knows WHO to message next
Agent({ prompt: "Research the codebase. SendMessage findings to 'architect'.",
  subagent_type: "researcher", name: "researcher", run_in_background: true })
Agent({ prompt: "Wait for 'researcher'. Design solution. SendMessage to 'coder'.",
  subagent_type: "system-architect", name: "architect", run_in_background: true })
Agent({ prompt: "Wait for 'architect'. Implement it. SendMessage to 'tester'.",
  subagent_type: "coder", name: "coder", run_in_background: true })
Agent({ prompt: "Wait for 'coder'. Write tests. SendMessage results to 'reviewer'.",
  subagent_type: "tester", name: "tester", run_in_background: true })
Agent({ prompt: "Wait for 'tester'. Review code quality and security.",
  subagent_type: "reviewer", name: "reviewer", run_in_background: true })

// Kick off the pipeline
SendMessage({ to: "researcher", summary: "Start", message: "[task context]" })
```

### Patterns

| Pattern | Flow | Use When |
|---------|------|----------|
| **Pipeline** | A → B → C → D | Sequential dependencies (feature dev) |
| **Fan-out** | Lead → A, B, C → Lead | Independent parallel work (research) |
| **Supervisor** | Lead ↔ workers | Ongoing coordination (complex refactor) |

### Rules

- ALWAYS name agents — `name: "role"` makes them addressable
- ALWAYS include comms instructions in prompts — who to message, what to send
- Spawn ALL agents in ONE message with `run_in_background: true`
- After spawning: STOP, tell user what's running, wait for results
- NEVER poll status — agents message back or complete automatically

## Swarm & Routing

### Config
- **Topology**: hierarchical-mesh (anti-drift)
- **Max Agents**: 15
- **Memory**: hybrid
- **HNSW**: Enabled
- **Neural**: Enabled

```bash
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized
```

### Agent Routing

| Task | Agents | Topology |
|------|--------|----------|
| Bug Fix | researcher, coder, tester | hierarchical |
| Feature | architect, coder, tester, reviewer | hierarchical |
| Refactor | architect, coder, reviewer | hierarchical |
| Performance | perf-engineer, coder | hierarchical |
| Security | security-architect, auditor | hierarchical |
| CyberSec audit/exploit/harden | cybersec:redteam-*, cybersec:blueteam-*, cybersec:purpleteam-coordinator | hierarchical-mesh |

### When to Swarm
- **YES**: 3+ files, new features, cross-module refactoring, API changes, security, performance
- **NO**: single file edits, 1-2 line fixes, docs updates, config changes, questions

### 3-Tier Model Routing

| Tier | Handler | Use Cases |
|------|---------|-----------|
| 1 | Agent Booster (WASM) | Simple transforms — skip LLM, use Edit directly |
| 2 | Haiku | Simple tasks, low complexity |
| 3 | Sonnet/Opus | Architecture, security, complex reasoning |

## Memory & Learning

### Before Any Task
```bash
npx @claude-flow/cli@latest memory search --query "[task keywords]" --namespace patterns
npx @claude-flow/cli@latest hooks route --task "[task description]"
```

### After Success
```bash
npx @claude-flow/cli@latest memory store --namespace patterns --key "[name]" --value "[what worked]"
npx @claude-flow/cli@latest hooks post-task --task-id "[id]" --success true --store-results true
```

### MCP Tools (use `ToolSearch("keyword")` to discover)

| Category | Key Tools |
|----------|-----------|
| **Memory** | `memory_store`, `memory_search`, `memory_search_unified` |
| **Bridge** | `memory_import_claude`, `memory_bridge_status` |
| **Swarm** | `swarm_init`, `swarm_status`, `swarm_health` |
| **Agents** | `agent_spawn`, `agent_list`, `agent_status` |
| **Hooks** | `hooks_route`, `hooks_post-task`, `hooks_worker-dispatch` |
| **Security** | `aidefence_scan`, `aidefence_is_safe`, `aidefence_has_pii` |
| **Hive-Mind** | `hive-mind_init`, `hive-mind_consensus`, `hive-mind_spawn` |

### Background Workers

| Worker | When |
|--------|------|
| `audit` | After security changes |
| `optimize` | After performance work |
| `testgaps` | After adding features |
| `map` | Every 5+ file changes |
| `document` | After API changes |

```bash
npx @claude-flow/cli@latest hooks worker dispatch --trigger audit
```

## Agents

**Core**: `coder`, `reviewer`, `tester`, `planner`, `researcher`
**Architecture**: `system-architect`, `backend-dev`, `mobile-dev`
**Security**: `security-architect`, `security-auditor`
**CyberSec RED**: `cybersec:redteam-coordinator`, `cybersec:redteam-recon`, `cybersec:redteam-exploit`
**CyberSec BLUE**: `cybersec:blueteam-coordinator`, `cybersec:blueteam-hardening`, `cybersec:blueteam-detect`, `cybersec:blueteam-incident`
**CyberSec PURPLE**: `cybersec:purpleteam-coordinator`
**Performance**: `performance-engineer`, `perf-analyzer`
**Coordination**: `hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`
**GitHub**: `pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`

Any string works as a custom agent type.

## Build & Test

- ALWAYS run tests after code changes
- ALWAYS verify build succeeds before committing

```bash
npm run build && npm test
```

## CLI Quick Reference

```bash
npx @claude-flow/cli@latest init --wizard           # Setup
npx @claude-flow/cli@latest swarm init --v3-mode     # Start swarm
npx @claude-flow/cli@latest memory search --query "" # Vector search
npx @claude-flow/cli@latest hooks route --task ""    # Route to agent
npx @claude-flow/cli@latest doctor --fix             # Diagnostics
npx @claude-flow/cli@latest security scan            # Security scan
npx @claude-flow/cli@latest performance benchmark    # Benchmarks
```

26 commands, 140+ subcommands. Use `--help` on any command for details.

## Setup

```bash
claude mcp add claude-flow -- npx -y @claude-flow/cli@latest
npx @claude-flow/cli@latest daemon start
npx @claude-flow/cli@latest doctor --fix
```

**Agent tool** handles execution (agents, files, code, git). **MCP tools** handle coordination (swarm, memory, hooks). **CLI** is the same via Bash.

## Scope Completion Protocol

After EACH scope item completes → generate caveman summary → save to Engram → surface to user.

### Caveman format (required)

```text
SCOPE [sdd-name] DONE.
LEVEL: [0-4] — [Trivial|Small|Medium|Large|Critical].
PROVIDERS: [local, engram, gentlePi, ruflo, ecc, context7, awesomeCopilot, ...].
PROCEDURE: [step1 → step2 → step3].
FILES: [N new | M modified].
TESTS: [N ne
---

## CYBERSECURITY HARNESS (BLUE / RED / PURPLE)

> Gru is also a security orchestrator. He does not exploit or patch directly —
> he delegates to cybersecurity minions. Offensive work is ALWAYS bounded by
> `cybersec-minion-contract.md` (Rules of Engagement: authorized scope only,
> lab/sandbox reproduction, no real-world targets, no exfiltration).
> Backed by the `@gru/cybersec` package (`packages/cybersec`).

### When this activates
Any request to audit security, find/exploit vulnerabilities, harden, threat-model,
run a red/blue/purple exercise, or "make Gru inexpugnable". On such requests Gru
MUST load `.claude/skills/cybersec-audit/SKILL.md` before acting.

### Minions (delegate, never self-execute)
| Team | Minion | Role |
|------|--------|------|
| RED | `cybersec:redteam-coordinator` | Plan/sequence the offensive campaign |
| RED | `cybersec:redteam-recon` | Map attack surface, trust boundaries |
| RED | `cybersec:redteam-exploit` | Build/run reversible PoC in the lab, prove impact |
| BLUE | `cybersec:blueteam-coordinator` | Triage findings, assign defense |
| BLUE | `cybersec:blueteam-hardening` | Apply canonical secure-pattern fix |
| BLUE | `cybersec:blueteam-detect` | Regression tests / detections / CI gates |
| BLUE | `cybersec:blueteam-incident` | Triage, contain, blameless postmortem |
| PURPLE | `cybersec:purpleteam-coordinator` | Drive the cyclic loop + persist learnings |

### Routing by complexity
- simple (Level 0-1): blue coordinator first.
- medium (Level 2-3): red + blue pair.
- complex (Level 3-4): purple coordinator (red+blue) + HUMAN approval gate.

### The cyclic loop ("I attack, Gru holds, the bar rises")
RECON → EXPLOIT → ASSESS → HARDEN → DETECT → REAUDIT → LEARN → repeat.
Red breach → OPEN finding. Blue must fix AND add a detection to close it. Two clean
cycles → escalate tier (simple→medium→complex). Clean at complex → HARDENED.
NEVER declare HARDENED while an OPEN finding remains.

### Self-learning
Each cycle persists one learning record to Engram:
`project:gru-orchestrator:cybersec:<defense|exploit-retired|weak-spot|regression>:<pattern>`
(newest-wins de-dup). This is the substrate for agents that train themselves; until
autonomous, the purple coordinator writes the memory.

### Mandatory sub-agent rule
Every cybersec sub-agent prompt MUST instruct the minion to read BOTH
`minion-contract.md` AND `cybersec-minion-contract.md` before any work, plus the
matching SKILL.md paths (see `packages/cybersec/src/teams.ts` skillBundleFor).

### References
- Code: `packages/cybersec` (`@gru/cybersec`) — severity, patterns, teams, loop, learning.
- Playbook: `docs/cybersec/ATTACK-DEFENSE-PLAYBOOK.md` — worked simple/medium/complex examples.
