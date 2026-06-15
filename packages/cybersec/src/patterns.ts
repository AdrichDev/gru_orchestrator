/**
 * Attack / Defense pattern catalog for Gru-CyberSec.
 *
 * Each pattern is a teaching artifact AND a routing record: it pairs an attack
 * (red team) with its detection and defense (blue team), tagged by complexity so
 * Gru can route simple/medium/complex work to the right minion. Examples are
 * intentionally concrete so agents learn to recognize, exploit-in-a-lab, and fix.
 *
 * ROE: exploit steps describe lab/self-test reproduction against the project's
 * OWN code or an authorized sandbox. Never against third-party systems.
 */

import type { Complexity, SeverityLabel } from "./severity.js";

export type Team = "red" | "blue" | "purple";

export interface AttackDefensePattern {
  id: string;
  /** OWASP Top 10 2021 category, e.g. "A03:2021-Injection". */
  owasp: string;
  /** Most specific CWE id, e.g. "CWE-89". */
  cwe: string;
  title: string;
  complexity: Complexity;
  baselineSeverity: SeverityLabel;
  /** One-line description of the weakness. */
  summary: string;
  /** How the blue team detects it (static/dynamic signal). */
  detection: string;
  /** Red-team reproduction in a lab / against own code. Educational. */
  exploitSketch: string;
  /** Blue-team fix. The canonical secure pattern. */
  defense: string;
  /** A short vulnerable→secure example pair the agents can pattern-match on. */
  example: { vulnerable: string; secure: string };
}

export const PATTERNS: readonly AttackDefensePattern[] = [
  // ---- SIMPLE ---------------------------------------------------------------
  {
    id: "secrets-in-source",
    owasp: "A07:2021-Identification and Authentication Failures",
    cwe: "CWE-798",
    title: "Hardcoded secrets / credentials in source",
    complexity: "simple",
    baselineSeverity: "high",
    summary: "API keys, tokens or passwords committed to the repository.",
    detection:
      "Entropy + regex scan of tracked files and git history; flag high-entropy strings, AWS/GitHub/Slack token shapes, and *.env committed files.",
    exploitSketch:
      "git log -p | grep -Ei 'api[_-]?key|secret|password|token'; reuse any live key against the corresponding sandbox API to prove validity.",
    defense:
      "Move secrets to env/secret manager; rotate exposed keys; add a pre-commit gitleaks-style hook; never log secrets.",
    example: {
      vulnerable: 'const API_KEY = "sk_live_9aZ...";',
      secure: 'const API_KEY = process.env.API_KEY ?? throwMissing("API_KEY");',
    },
  },
  {
    id: "missing-authz-check",
    owasp: "A01:2021-Broken Access Control",
    cwe: "CWE-862",
    title: "Missing authorization on a protected route",
    complexity: "simple",
    baselineSeverity: "high",
    summary: "Endpoint authenticates the user but never checks they may act on the resource.",
    detection:
      "Map every route to an ownership/role check; flag handlers that read `req.params.id` and query without a tenant/owner predicate.",
    exploitSketch:
      "Authenticate as user A, then request /api/orders/<B's id>; if A receives B's data → IDOR confirmed.",
    defense:
      "Enforce object-level authorization: scope every query by the authenticated principal; deny by default.",
    example: {
      vulnerable: "db.orders.find({ id: req.params.id })",
      secure: "db.orders.find({ id: req.params.id, ownerId: req.user.id })",
    },
  },
  {
    id: "verbose-error-leak",
    owasp: "A05:2021-Security Misconfiguration",
    cwe: "CWE-209",
    title: "Sensitive information in error responses",
    complexity: "simple",
    baselineSeverity: "low",
    summary: "Stack traces, SQL, or internal paths returned to the client.",
    detection: "Grep for `res.send(err)`, `err.stack` in responses, `DEBUG=true` in prod config.",
    exploitSketch:
      "Send malformed input to force a 500; read the stack trace to map ORM, file paths and library versions for the next stage.",
    defense: "Return generic error ids to clients; log details server-side only; disable debug in prod.",
    example: {
      vulnerable: "res.status(500).json({ error: err.stack })",
      secure: "logger.error(err); res.status(500).json({ error: 'internal_error', ref: traceId })",
    },
  },

  // ---- MEDIUM ---------------------------------------------------------------
  {
    id: "sql-injection",
    owasp: "A03:2021-Injection",
    cwe: "CWE-89",
    title: "SQL Injection via string concatenation",
    complexity: "medium",
    baselineSeverity: "critical",
    summary: "User input concatenated into a SQL statement.",
    detection:
      "Taint-track request input into query builders; flag template-literal/`+` SQL and raw ORM execution with unparameterized args.",
    exploitSketch:
      "Submit `' OR '1'='1' -- ` in a login field against the local dev DB; observe auth bypass. Escalate with UNION SELECT to read schema.",
    defense:
      "Use parameterized queries / prepared statements exclusively; allowlist column/sort names; least-privilege DB user.",
    example: {
      vulnerable: 'db.query(`SELECT * FROM users WHERE email = \'${email}\'`)',
      secure: "db.query('SELECT * FROM users WHERE email = $1', [email])",
    },
  },
  {
    id: "stored-xss",
    owasp: "A03:2021-Injection",
    cwe: "CWE-79",
    title: "Stored Cross-Site Scripting",
    complexity: "medium",
    baselineSeverity: "high",
    summary: "Untrusted content rendered into the DOM without encoding.",
    detection:
      "Flag `innerHTML`/`dangerouslySetInnerHTML` fed by user data; check templating auto-escape is on.",
    exploitSketch:
      "Persist `<img src=x onerror=fetch('/lab-collector?c='+document.cookie)>` in a comment field on the lab instance; confirm execution on render.",
    defense:
      "Contextual output encoding; prefer textContent; sanitize with a vetted library; strict CSP as defense-in-depth.",
    example: {
      vulnerable: "el.innerHTML = comment.body",
      secure: "el.textContent = comment.body // or DOMPurify.sanitize(...) for rich text",
    },
  },
  {
    id: "weak-jwt",
    owasp: "A02:2021-Cryptographic Failures",
    cwe: "CWE-347",
    title: "JWT signature not verified / alg=none accepted",
    complexity: "medium",
    baselineSeverity: "critical",
    summary: "Token accepted without verifying the signature or allowing `alg: none`.",
    detection:
      "Inspect JWT verification: flag `decode()` used instead of `verify()`, missing algorithm allowlist, or symmetric secret shorter than 256 bits.",
    exploitSketch:
      "Forge a token with `alg:none` and elevated `role:admin` claim; if the lab API accepts it → privilege escalation.",
    defense:
      "Always `verify()` with an explicit algorithm allowlist; strong secret/asymmetric keys; short expiry + rotation.",
    example: {
      vulnerable: "const claims = jwt.decode(token)",
      secure: "const claims = jwt.verify(token, key, { algorithms: ['RS256'] })",
    },
  },
  {
    id: "ssrf",
    owasp: "A10:2021-Server-Side Request Forgery",
    cwe: "CWE-918",
    title: "Server-Side Request Forgery",
    complexity: "medium",
    baselineSeverity: "high",
    summary: "Server fetches a user-supplied URL without validation.",
    detection: "Flag outbound HTTP where the URL/host comes from request input with no allowlist.",
    exploitSketch:
      "Point the URL param at the lab metadata endpoint (e.g. http://169.254.169.254/...) and observe internal data returned.",
    defense:
      "Allowlist destinations; resolve+validate IP (block link-local/private ranges); disable redirects; egress firewall.",
    example: {
      vulnerable: "await fetch(req.query.url)",
      secure: "assertAllowedHost(req.query.url); await fetch(req.query.url, { redirect: 'error' })",
    },
  },

  // ---- COMPLEX --------------------------------------------------------------
  {
    id: "deserialization-rce",
    owasp: "A08:2021-Software and Data Integrity Failures",
    cwe: "CWE-502",
    title: "Insecure deserialization → RCE",
    complexity: "complex",
    baselineSeverity: "critical",
    summary: "Untrusted serialized data instantiated into live objects, enabling gadget chains.",
    detection:
      "Flag deserialization of request/queue/cache payloads (node-serialize, pickle, Java readObject) without type allowlists or integrity checks.",
    exploitSketch:
      "Craft a gadget payload for the lab service; submit via the deserialized channel; confirm controlled code execution in the sandbox.",
    defense:
      "Prefer data-only formats (JSON) with schema validation; sign+verify payloads; never deserialize untrusted input into executable objects.",
    example: {
      vulnerable: "const obj = nodeSerialize.unserialize(req.body.payload)",
      secure: "const obj = schema.parse(JSON.parse(req.body.payload)) // verified signature first",
    },
  },
  {
    id: "race-condition-toctou",
    owasp: "A04:2021-Insecure Design",
    cwe: "CWE-367",
    title: "TOCTOU race on a financial/state operation",
    complexity: "complex",
    baselineSeverity: "high",
    summary: "Check and use are separated, letting concurrent requests double-spend or bypass limits.",
    detection:
      "Flag read-then-write on shared state without a transaction/lock/idempotency key (balances, coupons, inventory).",
    exploitSketch:
      "Fire N concurrent redeem requests against the lab wallet; if balance goes negative or a coupon redeems twice → race confirmed.",
    defense:
      "Atomic transactions with row locks or compare-and-set; idempotency keys; DB-level constraints as the final guard.",
    example: {
      vulnerable: "if (wallet.balance >= amt) { wallet.balance -= amt; save() }",
      secure: "UPDATE wallets SET balance = balance - $1 WHERE id=$2 AND balance >= $1 -- check rows affected",
    },
  },
  {
    id: "supply-chain-dep",
    owasp: "A06:2021-Vulnerable and Outdated Components",
    cwe: "CWE-1104",
    title: "Compromised / vulnerable dependency",
    complexity: "complex",
    baselineSeverity: "high",
    summary: "A transitive package with a known CVE or malicious postinstall script.",
    detection:
      "SCA over the lockfile; flag CVEs, install scripts, typosquats, and unexpected maintainer changes; verify integrity hashes.",
    exploitSketch:
      "In the lab, add a benign package with a postinstall that writes a marker file; prove arbitrary code runs at install time.",
    defense:
      "Pin + lock with integrity hashes; review install scripts; automated SCA gate in CI; minimal dependency surface.",
    example: {
      vulnerable: '"left-pad": "*"  // floating, unaudited',
      secure: '"left-pad": "1.3.0"  // pinned, hash-locked, SCA-gated',
    },
  },
] as const;

export function patternsByComplexity(c: Complexity): AttackDefensePattern[] {
  return PATTERNS.filter((p) => p.complexity === c);
}

export function patternById(id: string): AttackDefensePattern | undefined {
  return PATTERNS.find((p) => p.id === id);
}

export function patternsByOwasp(prefix: string): AttackDefensePattern[] {
  return PATTERNS.filter((p) => p.owasp.toLowerCase().startsWith(prefix.toLowerCase()));
}
