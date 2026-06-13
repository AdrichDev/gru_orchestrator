# Skill: purple-loop
# Trigger: red vs blue, security loop, self-training security, harden cyclically, "make it inexpugnable", continuous hardening
# Scope: purple-team coordinator
# Backed by: @gru/cybersec loop.ts + learning.ts

## THE LOOP
RECON -> EXPLOIT -> ASSESS -> HARDEN -> DETECT -> REAUDIT -> LEARN -> (repeat)

State machine rules (packages/cybersec/src/loop.ts):
- Red breach -> finding goes OPEN. Blue must fix AND add detection to close it.
- Cycle is CLEAN only if zero OPEN after re-audit.
- 2 clean cycles -> ESCALATE tier: simple -> medium -> complex.
- Clean at complex -> HARDENED (re-arm with new patterns to continue).
- NEVER declare HARDENED with any OPEN finding.

## "I TRY TO ENTER, GRU DOESN'T LET ME"
Each cycle = one intrusion attempt. The loop keeps grinding a tier until red
breaks nothing, then raises difficulty. The goal is to raise the floor every
cycle, not to win once.

## SELF-LEARNING (Engram)
One learning record per cycle:
```
kind: defense | exploit-retired | weak-spot | regression
key:  project:gru-orchestrator:cybersec:<kind>:<pattern>
```
De-duplicate newest-wins (learning.ts mergeLearning). This memory is what lets
future sessions — and eventually the agents themselves — start smarter.

## DRIVER STEPS
1. initLoop(tier). 2. Run red minions -> recordExploit. 3. Run blue -> recordHardening.
4. closeCycle() -> hold | escalate | hardened. 5. Persist learning. 6. Caveman digest to Gru.

## OUTPUT
```
LOOP cycle=<n> tier=<...> open=[...] hardened=[...] decision=<...>
LEARNING: <one record>
```
