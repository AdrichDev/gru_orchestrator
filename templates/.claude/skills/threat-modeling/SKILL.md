# Skill: threat-modeling
# Trigger: threat model, STRIDE, attack tree, trust boundary, attack surface, abuse case
# Scope: red-team planning + blue-team design review
# Backed by: docs/cybersec/ATTACK-DEFENSE-PLAYBOOK.md (section 4)

## PURPOSE
Systematically enumerate how the in-scope system can be attacked BEFORE exploitation.

## STRIDE CHECKLIST
| Threat | Ask | Maps to patterns |
|--------|-----|------------------|
| Spoofing | identity fakeable? | weak-jwt, missing-authz-check |
| Tampering | data alterable? | deserialization-rce, sql-injection |
| Repudiation | actions deniable? | verbose-error-leak (logging) |
| Information disclosure | data leaks? | missing-authz-check (IDOR), ssrf, verbose-error-leak |
| Denial of service | exhaustible? | race-condition-toctou |
| Elevation of privilege | privilege rises? | weak-jwt (alg:none), missing-authz-check |

## METHOD
1. Take the recon target map (entry points, trust boundaries, taint sources).
2. For each boundary, walk STRIDE; list concrete abuse cases.
3. Rank by likelihood x impact; map each to a catalog pattern id.
4. Output an ordered attack hypothesis list for the red coordinator.

## OUTPUT
```
THREAT MODEL
BOUNDARY <name>: [<STRIDE> -> <abuse case> -> <pattern-id>]
RANKED HYPOTHESES: 1..n
```
