# Skill: cybersec-audit
# Trigger: security audit, vulnerability scan, "is this safe", pentest, harden, threat model, red/blue team, CVE, OWASP, CWE
# Scope: entry point for all Gru-CyberSec work — routes to red/blue/purple minions
# Backed by: @gru/cybersec (packages/cybersec)

## WHEN GRU USES THIS
Any request to audit security, find vulnerabilities, attack/defend, or harden the
project. This skill orchestrates; it does not execute. Gru delegates to minions.

## MANDATORY FIRST STEPS
1. Confirm SCOPE_ASSETS (own code / authorized sandbox). No scope -> ask once, then BLOCK.
2. Inject `cybersec-minion-contract.md` into EVERY sub-agent prompt (ROE).
3. Filesystem Scan (Step 0) before classifying.

## ROUTING

| Finding complexity | First minion | Gru Level |
|--------------------|--------------|-----------|
| simple  | cybersec:blueteam-coordinator | 0-1 |
| medium  | cybersec:redteam-coordinator + blue | 2-3 |
| complex | cybersec:purpleteam-coordinator (red+blue+human gate) | 3-4 |

## SEVERITY (mirror of @gru/cybersec severity.ts)
informational(1) low(2) medium(3) high(4) critical(5).
Score = impact*0.5 + exploitability*0.3 + exposure*0.2 (0..10).
critical>=9 -> Level 4 + human gate. high>=7 -> Level 3 + human gate.

## OUTPUT
A triaged finding list (id, CWE, severity, owner, gruLevel, humanGate) + handoffs.
Persist decisions via `cybersec:purpleteam-coordinator` to Engram.

## PATTERN CATALOG
The authoritative attack/defense pairs live in:
- code: `packages/cybersec/src/patterns.ts` (`PATTERNS`)
- docs: `docs/cybersec/ATTACK-DEFENSE-PLAYBOOK.md`
