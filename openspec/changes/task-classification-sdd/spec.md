# Spec: Task Classification Service

## R1 — Complexity scoring

### R1a — Single file
- GIVEN `filesAffected: 1`, no other signals
- WHEN `scoreComplexity(signals)` runs
- THEN returns 0

### R1b — 2-3 files
- GIVEN `filesAffected: 3`
- WHEN `scoreComplexity(signals)` runs
- THEN returns 1

### R1c — 4+ files
- GIVEN `filesAffected: 4`
- WHEN `scoreComplexity(signals)` runs
- THEN returns >= 2

### R1d — Multiple domains
- GIVEN `domainsCrossed: 2`
- WHEN `scoreComplexity(signals)` runs
- THEN score includes +2

### R1e — New architecture
- GIVEN `requiresNewArchitecture: true`
- WHEN `scoreComplexity(signals)` runs
- THEN score includes +2

---

## R2 — Risk scoring

### R2a — Irreversible change
- GIVEN `isIrreversible: true`
- WHEN `scoreRisk(signals)` runs
- THEN returns >= 3

### R2b — Production + security
- GIVEN `touchesProduction: true, touchesSecurityOrAuth: true`
- WHEN `scoreRisk(signals)` runs
- THEN returns >= 6

### R2c — Reversible, no risk signals
- GIVEN no risk signals
- WHEN `scoreRisk(signals)` runs
- THEN returns 0

---

## R3 — Level from score

### R3a — Trivial
- GIVEN `complexityScore + riskScore === 0`
- THEN level is 0

### R3b — Small
- GIVEN total 1-2
- THEN level is 1

### R3c — Medium
- GIVEN total 3-4
- THEN level is 2

### R3d — Large
- GIVEN total 5-7
- THEN level is 3

### R3e — Critical
- GIVEN total >= 8
- THEN level is 4

---

## R4 — Viability

### R4a — Ready
- GIVEN no risk signals, no missing capability
- THEN viability is `"ready"`

### R4b — Needs approval
- GIVEN `touchesProduction: true` AND `isIrreversible: true`
- THEN viability is `"needs_approval"`

### R4c — Blocked
- GIVEN `missingCapability: "some-provider"`
- THEN viability is `"blocked"`
- AND `TaskClassification.blockedReason` names the missing capability

### R4d — Security triggers needs_approval
- GIVEN `touchesSecurityOrAuth: true`
- THEN viability is `"needs_approval"`

---

## R5 — Prompt heuristics

### R5a — Production keyword
- GIVEN prompt contains "production" or "deploy"
- WHEN `inferSignalsFromPrompt(prompt)` runs
- THEN `touchesProduction` is true

### R5b — Security keyword
- GIVEN prompt contains "security" or "auth" or "cve"
- WHEN `inferSignalsFromPrompt(prompt)` runs
- THEN `touchesSecurityOrAuth` is true

### R5c — Delete/irreversible keyword
- GIVEN prompt contains "delete" or "drop" or "migrate"
- WHEN `inferSignalsFromPrompt(prompt)` runs
- THEN `isIrreversible` is true

### R5d — Neutral prompt
- GIVEN prompt is "add comment to function"
- WHEN `inferSignalsFromPrompt(prompt)` runs
- THEN all inferred signals are false

---

## R6 — Full classification

### R6a — Trivial task
- GIVEN `classifyTask("add comment", {})`
- THEN `level === 0`, `viability === "ready"`, `requiresDevilsAdvocate === false`

### R6b — Medium task requires devil
- GIVEN `classifyTask(prompt, { filesAffected: 3, domainsCrossed: 2 })`
- THEN `level >= 2`, `requiresDevilsAdvocate === true`

### R6c — Critical task requires human approval
- GIVEN `classifyTask(prompt, { filesAffected: 4, touchesProduction: true, touchesSecurityOrAuth: true, isIrreversible: true })`
- THEN `level === 4`, `viability === "needs_approval"`, `requiresDevilsAdvocate === true`, `requiresHumanApproval === true`

### R6d — Missing capability blocks
- GIVEN `classifyTask(prompt, { missingCapability: "harness-subagents" })`
- THEN `viability === "blocked"`, `blockedReason` contains `"harness-subagents"`
