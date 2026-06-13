# Gru-CyberSec — Attack / Defense Playbook

> Source of truth for the cyclic red-vs-blue exercise. Pairs every attack with
> its detection and defense. Bounded by `cybersec-minion-contract.md` (ROE).
> Backed by code: `@gru/cybersec` (`packages/cybersec`) holds the same catalog as
> typed data (`PATTERNS`) plus the loop state machine.

---

## 1. The cyclic loop ("I attack, Gru holds, the bar rises")

```
        ┌──────────────────────────────────────────────────────────┐
        │                                                          ▼
   ┌─────────┐   ┌──────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌─────────┐   ┌───────┐
   │ RECON   │──▶│ EXPLOIT  │──▶│ ASSESS │──▶│ HARDEN │──▶│ DETECT │──▶│ REAUDIT │──▶│ LEARN │
   │ (red)   │   │ (red)    │   │(purple)│   │ (blue) │   │ (blue) │   │ (purple)│   │(purple)│
   └─────────┘   └──────────┘   └────────┘   └────────┘   └────────┘   └─────────┘   └───────┘
        ▲                                                                                │
        │      red broke something → keep tier, grind                                    │
        └──── red broke nothing for a clean streak → ESCALATE tier ◄──────────────────────┘
                       simple → medium → complex → HARDENED (re-arm with new patterns)
```

Rules (enforced in code by `packages/cybersec/src/loop.ts`):

- Anything red breaches in EXPLOIT becomes an **open finding**.
- Blue must close every open finding in HARDEN **and** add a detection in DETECT.
- A cycle is "clean" only if zero open findings remain after re-audit.
- Two clean cycles at a tier → escalate difficulty. Clean at `complex` → `hardened`.
- Never declare `hardened` while an open finding exists.

Each cycle ends with one **learning record** persisted to Engram
(`project:gru-orchestrator:cybersec:<kind>:<pattern>`), so the next session starts
smarter. This is the bridge to self-training agents: until they run autonomously,
the purple-team coordinator drives the loop and writes the memory.

---

## 2. Routing by complexity

| Tier | Owner first response | Gru Level | Example classes |
|------|----------------------|-----------|-----------------|
| simple | blue hardening | 0–1 | hardcoded secrets, missing authz, verbose errors |
| medium | blue + red pair | 2–3 | SQLi, stored XSS, weak JWT, SSRF |
| complex | purple (red+blue) + human gate | 3–4 | insecure deserialization (RCE), TOCTOU race, supply chain |

---

## 3. Worked examples

Each example follows the same shape the agents must produce:
**recognize → exploit (lab) → detect → defend → regression test.**

### 3.1 SIMPLE — Hardcoded secret (CWE-798)

- **Recognize:** entropy/regex scan flags `const API_KEY = "sk_live_..."`.
- **Exploit (lab):** `git log -p | grep -Ei 'secret|api[_-]?key|token'`; the key is reusable → confirmed.
- **Detect:** pre-commit gitleaks-style hook; CI secret scan over history.
- **Defend:** move to `process.env`, rotate the key, never log it.
- **Regression test:** a test that fails if any tracked file matches a secret signature.

### 3.2 SIMPLE — Broken access control / IDOR (CWE-862)

- **Recognize:** handler reads `req.params.id` and queries with no owner predicate.
- **Exploit (lab):** auth as user A, request B's resource id → A receives B's data.
- **Detect:** route-to-authz map; test that A cannot read B's object.
- **Defend:** scope every query by `req.user.id`; deny by default.
- **Regression test:** cross-tenant access returns 403/404.

### 3.3 MEDIUM — SQL Injection (CWE-89)

- **Recognize:** `db.query(\`... WHERE email = '${email}'\`)`.
- **Exploit (lab):** submit `' OR '1'='1' -- ` → auth bypass on dev DB; `UNION SELECT` to read schema.
- **Detect:** taint rule flags string-built SQL; SAST gate in CI.
- **Defend:** parameterized queries only; least-privilege DB user; allowlist sort/columns.
- **Regression test:** the injection payload returns no rows / is rejected.

### 3.4 MEDIUM — Weak JWT (CWE-347)

- **Recognize:** `jwt.decode()` used instead of `verify()`, or `alg:none` accepted.
- **Exploit (lab):** forge `alg:none` token with `role:admin` → privilege escalation.
- **Detect:** lint/test that asserts verification uses an algorithm allowlist.
- **Defend:** `jwt.verify(token, key, { algorithms: ['RS256'] })`; strong keys; short expiry.
- **Regression test:** forged/none-alg token is rejected.

### 3.5 COMPLEX — Insecure deserialization → RCE (CWE-502)

- **Recognize:** `nodeSerialize.unserialize(req.body.payload)` on untrusted input.
- **Exploit (lab):** craft a gadget payload against the sandbox service → controlled execution; STOP after proof.
- **Detect:** flag any deserialization of request/queue/cache data without schema + signature.
- **Defend:** JSON + schema validation; sign & verify payloads; never instantiate untrusted objects.
- **Regression test:** gadget payload is rejected by schema/signature before execution.

### 3.6 COMPLEX — TOCTOU race (CWE-367)

- **Recognize:** read-then-write on a balance/coupon/inventory without a transaction/lock.
- **Exploit (lab):** fire N concurrent redeems against the lab wallet → negative balance / double redeem.
- **Detect:** test that runs concurrent requests and asserts invariants hold.
- **Defend:** atomic `UPDATE ... WHERE balance >= amt` (check rows affected) + idempotency keys + DB constraints.
- **Regression test:** concurrent redeem leaves exactly one success.

---

## 4. Threat modeling shortcut (STRIDE)

Before each campaign, the red coordinator runs STRIDE over the target map:

| Threat | Question | Maps to |
|--------|----------|---------|
| **S**poofing | Can identity be faked? | auth, JWT, sessions |
| **T**ampering | Can data be altered? | integrity, deserialization |
| **R**epudiation | Can actions be denied? | logging, audit trail |
| **I**nfo disclosure | Can data leak? | errors, IDOR, SSRF |
| **D**enial of service | Can it be exhausted? | rate limits, races |
| **E**levation | Can privilege rise? | authz, alg:none |

---

## 5. Definition of "inexpugnable"

Gru is **hardened for the current pattern set** when, at the `complex` tier, red
runs a full RECON→EXPLOIT pass and breaches nothing for two consecutive cycles,
with every prior finding carrying both a fix and a detection. This is not "done
forever" — it is "re-arm with new patterns and grind again." The loop never
claims final victory; it raises the floor.
