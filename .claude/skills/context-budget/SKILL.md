# Skill: context-budget
# Trigger: when Gru needs to read a large file (> 150 lines) or explore 4+ files
# Scope: all file reads by the orchestrator
# Purpose: prevent context inflation by delegating large reads to cavecrew-investigator

## RULE

Files > 150 lines: DO NOT read inline. Delegate to `cavecrew-investigator`.
Hook enforces this automatically via `PreToolUse(Read)`.

## THRESHOLDS

| Condition | Action |
|---|---|
| Single file ≤ 500 lines | Read inline — allowed |
| Single file > 500 lines (no offset/limit) | BLOCKED by hook → delegate |
| Partial read (offset or limit set) | Always allowed |
| 4+ files for exploration | Delegate exploration task |

## CAVEMAN SUMMARY FORMAT

When delegating to `cavecrew-investigator`, request this exact format:

```
FILE: <path> (<N> lines)
PURPOSE: <one sentence — what this module does>
EXPORTS: <TypeA, funcB, CONST_C>
KEY_TYPES: <interface X { fieldA, fieldB }, type Y = ...>
DECISIONS: <L42: notable logic; L88: guard condition; L120: edge case>
DEPS: <./foo, ./bar, external-lib>
```

Target: ≤ 25 lines per file summary. ~85% context reduction vs full read.

## AGENT CALL PATTERN

```javascript
Agent({
  subagent_type: "caveman:cavecrew-investigator",
  model: "haiku",
  prompt: `Read the minion-contract.md at project root first.
Read <file-path>. Return caveman summary only:
FILE: <path> (<N> lines)
PURPOSE: <one sentence>
EXPORTS: <TypeA, funcB, ConstC>
KEY_TYPES: <interface/type signatures, key fields only>
DECISIONS: <L42: notable logic; L88: guard condition>
DEPS: <./foo, ./bar, external-lib>`
})
```

## MULTI-FILE EXPLORATION

For 4+ files, fan-out or single investigator with multiple files:

```javascript
Agent({
  subagent_type: "caveman:cavecrew-investigator",
  model: "haiku",
  prompt: `Read the minion-contract.md at project root first.
Explore these files and return caveman summary for each:
- <file1>
- <file2>
- <file3>
- <file4>
Use caveman summary format per file. Max 25 lines per file.`
})
```

## HOW GRU USES SUMMARIES

1. Receive summary (~10-25 lines per file).
2. Incorporate into session context as compressed reference.
3. If specific line needed → targeted partial Read with offset/limit (allowed).
4. Never re-read entire file after summary — use summary + partial reads only.

## HOOK LOCATION

`.claude/helpers/context-guard.cjs`
`.claude/settings.json` → `PreToolUse[matcher: "Read"]`

## WHEN TO OVERRIDE

If the task requires exact code for editing → use `Read` with `offset` + `limit`
to target only the relevant section. Never override by reading the full file.
