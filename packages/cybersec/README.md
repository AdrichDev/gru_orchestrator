# @gru/cybersec — Gru-CyberSec

Blue/Red/Purple team harness for Gru. Pure, testable building blocks that turn
Gru into an adversary-resistant machine. **Gru orchestrates; cybersec minions
produce.** This package holds the *data and logic*; the agents and skills under
`.claude/` hold the *behavior*.

## Modules

| Module | Export | Purpose |
|--------|--------|---------|
| `severity` | `classifyRisk`, `scoreRisk`, `escalationFor` | CVSS-lite scoring + mapping to Gru Decision-Table levels (0–4). |
| `patterns` | `PATTERNS`, `patternsByComplexity` | Attack/defense catalog (OWASP 2021 / CWE), tiered simple→medium→complex, with vulnerable→secure examples. |
| `teams` | `TEAM_REGISTRY`, `skillBundleFor` | Registry of cybersecurity minions + the SKILL.md bundle (contract first) Gru injects into each sub-agent. |
| `loop` | `initLoop`, `advance`, `closeCycle`, `isHardened` | Cyclic red-vs-blue self-training state machine: "I attack, Gru holds, difficulty ratchets up." |
| `learning` | `LearningRecord`, `engramKey`, `mergeLearning` | Self-learning records persisted to Engram so future sessions start smarter. |

## The cyclic loop

```
RECON → EXPLOIT → ASSESS → HARDEN → DETECT → REAUDIT → LEARN ─┐
  ▲                                                            │
  └───────────── escalate tier when red is blocked ◄───────────┘
```

Red attacks at the current tier. Anything it breaches becomes an open finding.
Blue hardens + writes detection. The loop re-audits. When red breaks nothing for
a clean streak, difficulty escalates (`simple → medium → complex`). Clean at the
top tier ⇒ `hardened` (impregnable for the current pattern set). Add patterns to
re-arm and the grind continues.

## Rules of engagement

All offensive work is bounded by `cybersec-minion-contract.md` at the repo root:
authorized scope only, lab/sandbox reproduction, **no real-world targets**, no
exfiltration, no destructive payloads. Exploit sketches in `patterns` are for the
project's own code or an approved sandbox.

## Test

```bash
pnpm --filter @gru/cybersec test     # vitest
pnpm --filter @gru/cybersec typecheck
```
