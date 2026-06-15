# Skill: blueteam-defense
# Trigger: harden, fix vulnerability, secure pattern, mitigation, detection, regression test, incident response, blue team
# Scope: defensive minions (hardening, detect, incident, blue coordinator)

## TWO-PART RULE
Every closed finding needs BOTH:
1. ROOT-CAUSE FIX (the canonical secure pattern), AND
2. DETECTION (a regression test that FAILS on the old code + passes on the fix).
No detection -> finding is NOT closed.

## SECURE PATTERNS (vulnerable -> secure)
- SQLi: `query(\`...${x}\`)` -> parameterized `query('... $1', [x])`.
- XSS: `el.innerHTML = data` -> `el.textContent = data` / sanitize; add CSP.
- JWT: `jwt.decode()` -> `jwt.verify(t, key, { algorithms: ['RS256'] })`.
- SSRF: `fetch(req.query.url)` -> allowlist host + block private ranges + no redirects.
- IDOR: `find({ id })` -> `find({ id, ownerId: req.user.id })`; deny by default.
- Secrets: literal -> `process.env.X`; rotate; pre-commit secret scan.
- Deserialization: `unserialize(input)` -> JSON + schema + verified signature.
- TOCTOU: read-then-write -> atomic `UPDATE ... WHERE balance>=amt` + idempotency key.

## DETECTION LAYERS (cheapest first)
lint/test  >  CI gate (SAST/SCA/secret-scan)  >  runtime alert.

## INCIDENT RESPONSE
Live compromise / live secret -> STOP, do not use, STATUS: ESCALATE to human.
Contain -> preserve evidence -> timeline -> root cause -> blameless postmortem.

## OUTPUT
```
FIX id=<pattern> secure_pattern=<...> poc_repro_after_fix=false
DETECTION test=<path> (fails on old code)
```
Full catalog: `packages/cybersec/src/patterns.ts`, `docs/cybersec/ATTACK-DEFENSE-PLAYBOOK.md`.
