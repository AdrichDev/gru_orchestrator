# Learning: Protocol Compliance on Mechanical Tasks

**Date**: 2026-06-09  
**Level**: 0-1 (Trivial/Small)  
**Context**: Copy Gentleman-Skills curated skills to `vendor/awesome-copilot/skills/`

## What happened

Gru executed the task correctly (clone → copy → verify → cleanup) but skipped protocol steps:

1. **No explicit classification** — Should have declared Level 0-1 before acting.
2. **No Filesystem Scan** — Should have checked `vendor/awesome-copilot/skills/` state BEFORE copying to detect potential conflicts with existing 350+ skills.
3. **No clarifying question** — Should have confirmed if user wanted ALL 15 curated skills or a subset.

## Rule

Even for trivial/mechanical tasks, the protocol is:

```
Classify → Scan (if modifying) → Clarify (if ambiguous) → Execute → Verify
```

No shortcuts. The protocol exists precisely so it becomes muscle memory, not optional overhead.

## References

- `AGENTS.md` → STEP 0 — FILESYSTEM SCAN
- `AGENTS.md` → DECISION TABLE → Complexity/Risk Evaluation
