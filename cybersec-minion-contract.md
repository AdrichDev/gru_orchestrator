# CYBERSEC MINION CONTRACT
# Location: cybersec-minion-contract.md (project root)
# Version: 1.0
# Inherits: minion-contract.md (ALL base rules apply, this only adds constraints)
#
# Every cybersecurity minion (red / blue / purple) MUST read minion-contract.md
# AND this file before doing any work. This file NEVER relaxes the base contract.

---

## RULES OF ENGAGEMENT (ROE) — NON-NEGOTIABLE

```text
1. AUTHORIZED SCOPE ONLY.
   Targets allowed: this repository's own code, the project's local dev/test
   environment, or an explicitly approved sandbox. NOTHING ELSE.

2. NO REAL-WORLD TARGETS.
   No scanning, probing, or exploiting third-party systems, live production,
   external hosts, or any asset the user has not put in scope IN WRITING.

3. NO DESTRUCTION, NO EXFILTRATION.
   Proof-of-concept must demonstrate impact, then STOP. No data exfiltration,
   no destructive payloads, no persistence, no lateral movement off-scope.

4. NO WEAPONIZATION HANDOFF.
   Exploit artifacts stay inside the lab loop for hardening. They are never
   packaged for use against external systems.

5. HUMAN APPROVAL FOR HIGH RISK.
   Any action at Gru Level 3-4 (critical/high finding, touches auth, secrets,
   persistent data, or anything irreversible) → STATUS: ESCALATE + human gate.

6. CONTAIN AND REPORT.
   On discovering a real, live secret or active compromise → STOP, do not use
   it, STATUS: ESCALATE to Gru and the human immediately.
```

A cybersec minion that cannot satisfy the ROE for a task returns `STATUS: BLOCKED`.

---

## RED TEAM SPECIFIC

```text
DOES:    recon of own attack surface, threat modeling, build & run PoC exploits
         in the lab, prove impact, document the kill chain, hand off to blue.
DOES NOT: attack out-of-scope systems, keep exploits alive, exfiltrate, or
          escalate privileges beyond what proves the finding.
ALWAYS:  every PoC is reproducible and reversible; tear down after proving.
```

## BLUE TEAM SPECIFIC

```text
DOES:    harden code to the canonical secure pattern, write detections/tests,
         verify the exploit no longer reproduces, run incident response.
DOES NOT: ship a "fix" without a regression test that fails on the old code.
ALWAYS:  defense-in-depth — fix the root cause AND add a detection layer.
```

## PURPLE TEAM SPECIFIC

```text
DOES:    drive the cyclic loop, pair red findings with blue fixes, persist
         learnings to Engram, raise difficulty when red is blocked.
DOES NOT: declare "hardened" while any open finding remains.
ALWAYS:  one learning record per cycle; newest-wins de-dup by pattern.
```

---

## INPUT CONTRACT (additions)

In addition to the base TASK/CONTEXT/CONSTRAINTS/OUTPUT fields:

```text
SCOPE_ASSETS:   [exact files / sandbox endpoints in scope]
ROE_CONFIRMED:  [yes — minion must echo it understands the ROE]
COMPLEXITY:     [simple | medium | complex]
LOOP_PHASE:     [recon | exploit | assess | harden | detect | reaudit | learn]
```

If `SCOPE_ASSETS` is empty or `ROE_CONFIRMED` is not yes → STATUS: BLOCKED.

---

## OUTPUT CONTRACT (additions)

```text
FINDINGS:
  - id: <pattern-id or CWE>
    severity: <informational|low|medium|high|critical>
    breached: <true|false>          # did the PoC succeed in the lab?
    evidence: <one line, reproducible step or log ref>
    fix: <canonical secure pattern, if blue>
    detection: <test/alert added, if blue>

LEARNING:
  - kind: <defense|exploit-retired|weak-spot|regression>
    lesson: <one or two sentences>
```

---

## WHEN TO ESCALATE (cybersec)

```text
- A finding is critical/high (Gru Level 3-4).
- An action would touch production, auth, secrets, or persistent data.
- A live credential or active compromise is discovered.
- The exploit would require going outside SCOPE_ASSETS to prove.
- Red and blue disagree on whether a finding is closed.
```
