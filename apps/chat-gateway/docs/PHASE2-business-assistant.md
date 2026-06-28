# Phase 2 — Business Assistant (design)

> Status: **design only, not implemented.** This documents how the "personal
> assistant" use case ("nuevo cliente → genera presupuesto → valida → manda por
> mail") fits the architecture **without** turning the WhatsApp gateway into a
> parallel orchestrator.

## The boundary (why this is not in v1)

The v1 gateway is a thin channel: WhatsApp message → `orchestrateTask` → reply.
Business actions like *generate a budget*, *validate it*, *send it by email* are
**capabilities**, not channel concerns. Per Gru's own rule ("la lógica vive en
Gru"), the WhatsApp layer must never send emails or render PDFs directly.

So Phase 2 is **not** new code in `apps/chat-gateway`. It is a new
**capability** reachable through Gru. The gateway stays unchanged — it already
relays any natural-language directive.

## Two candidate homes for the capability

```
          ┌─────────────────────── Option A: capability inside Gru ──────────────┐
WhatsApp →│ gateway → orchestrateTask("genera presupuesto cliente X…")           │
          │            → Router → minion-business (new) → providers: pdf, email  │
          └─────────────────────────────────────────────────────────────────────┘

          ┌──────────────── Option B: capability inside 3A_Estudio (recommended) ┐
WhatsApp →│ gateway → orchestrateTask(…) → Gru delegates a business *operation*  │
          │            → 3A_Estudio HTTP API (it already knows budgets+clients)  │
          │            → 3A_Estudio renders PDF + sends email, returns result    │
          └─────────────────────────────────────────────────────────────────────┘
```

| | A: capability in Gru | B: capability in 3A_Estudio (recommended) |
|---|---|---|
| Budget logic | reimplemented in a minion | reuses the app that already owns it |
| Data access | Gru needs 3A's DB/models | stays in 3A, Gru just calls the API |
| Email/PDF | new Gru providers | 3A's existing stack |
| Coupling | Gru learns business domain | Gru stays domain-agnostic orchestrator |
| Effort | high (new minion + 2 providers + domain) | low–medium (one API + one delegate) |

**Recommendation: Option B.** 3A_Estudio already knows clients, budgets, its mail
sender and templates. Gru should orchestrate, not re-own the business domain.

## Option B — concrete shape

### 1. 3A_Estudio exposes a small internal API

A few authenticated endpoints, e.g.:

```
POST /api/budgets            { clientData }            -> { budgetId, total, pdfUrl }
POST /api/budgets/:id/validate                          -> { status }
POST /api/budgets/:id/send-email { to }                 -> { sent: true }
```

Auth: a service token Gru holds (never the WhatsApp layer). Destructive/outbound
steps (send-email) are the ones the risk gate must gate.

### 2. Gru gains a `business` delegation operation

Gru already has a delegation layer (`gru delegate <provider> --operation <op>`,
`packages/kernel/src/delegates/`). Add a delegate whose `execute()` calls the
3A_Estudio API. The directive's intent ("genera presupuesto … mándalo por mail")
is parsed by Gru's Router into the `business` operation; the delegate performs the
HTTP calls in order and returns a chat-friendly summary.

> This touches **Gru core** (a new delegate + routing rule). Per the project
> constraints, that change needs explicit approval before implementation — it is
> intentionally left as design here.

### 3. Risk / human-in-the-loop reuse

The "send email" step is outbound and irreversible-ish → it should raise the risk
classification so `orchestrateTask` throws `HumanApprovalRequiredError`. The
**existing v1 WhatsApp approval flow then works unchanged**: you get "responde SÍ"
(or `SÍ` + `CONFIRMO` for the send) before any mail leaves. No new approval code
in the gateway.

## Decisions locked (user answers)

- **Q3 — Option B confirmed**: business logic stays in 3A_Estudio. Gru only
  orchestrates and calls 3A over HTTP.
- **Stack**: 3A_Estudio is **Node / TypeScript**.
- **Q4 — approved**: a `business` delegate may be added to Gru core
  (`packages/kernel/src/delegates/` + a routing rule).
- **Q2 — open / "no sé"**: email-sending location unknown.
- **Q1 — open / "no sé"**: unknown whether 3A already exposes an HTTP API.

## The Gru ↔ 3A contract (fixed regardless of whether the API exists yet)

Gru's `business` delegate will speak this contract. If 3A already has endpoints,
we map onto them; if not, 3A must add these (Node/TS):

```
Auth:  Authorization: Bearer <THREEA_API_TOKEN>   (service token, Gru-side only)
Base:  THREEA_API_BASE_URL

POST /api/budgets               { client }                 -> { budgetId, total, pdfUrl }
POST /api/budgets/:id/validate                              -> { status }            # reversible
POST /api/budgets/:id/send-email { to }                     -> { sent: true }        # OUTBOUND → risk gate
```

Delegate env (Gru side): `THREEA_API_BASE_URL`, `THREEA_API_TOKEN`.

Risk: the `send-email` step is outbound → it must raise the kernel risk
classification so `orchestrateTask` throws `HumanApprovalRequiredError`. The
existing chat approval flow (`SÍ` / `SÍ`+`CONFIRMO`) then gates the send with NO
new gateway code.

## Reality check — 3A_Estudio inspected (supersedes the contract above)

Real path: `D:/Adrian/22. Proyectos/3A_Estudio`. The relevant sub-project is
**`agents-agency`** (Express + Prisma + OpenAI, back on :4000, all routes under
`/api`, auth = **Supabase Bearer token**, gate loads `aa.User`).

What it ALREADY has (verified):

- `/api/clients` — full CRUD.
- `/api/budgets` — GET list / GET :id / POST create (`budgetCreateSchema`) /
  PUT :id (status update → "validate").
- `/api/ai/chat` — runs the **agent loop** (OpenAI function-calling) with tools.
- Email is **NOT a REST endpoint**. It is the agent tool `send_email` →
  `lib/integrations/gmail.ts sendEmail(token, to, subject, body)`, using a
  per-tenant **Gmail OAuth** token (`withToken("gmail", …)`).
- Its **own WhatsApp + Telegram channels** (`/api/channels/:provider/connect`,
  `telegram-webhook`, `whatsapp-webhook`).

### Consequence (the earlier discrete-endpoint contract is wrong)

- `POST /api/budgets/:id/send-email` **does not exist**; email only flows through
  the agent loop + Gmail OAuth.
- The "nuevo cliente → presupuesto → validar → mail" assistant is **already
  natively supported** by agents-agency — including its own chat channels. A Gru
  `business` delegate that re-orchestrates discrete calls would duplicate the
  agent loop and still hit the missing email endpoint.

### Revised options (decision needed before any code)

1. **Don't build it (recommended).** The business assistant lives in
   agents-agency, which already does it end-to-end with its own WhatsApp/Telegram.
   Gru's chat-gateway stays focused on dev/engineering orchestration. No overlap.
2. **Thin pass-through delegate.** Gru `business` op → single `POST /api/ai/chat`
   on agents-agency with the NL instruction; its agent does clients+budgets+email.
   Lets ONE Gru/chat-gateway entry also reach business actions. Needs: agents-agency
   base url, a Supabase **service token**, and a target agent id. Risk gate still
   applies (outbound mail → `SÍ`/`CONFIRMO`).
3. **Discrete-endpoint orchestration in Gru (NOT recommended).** Gru calls
   `/clients` + `/budgets` directly and 3A must add a REST `send-email` endpoint.
   Most work, duplicates the agent loop.

### DECISION (chosen)

**Option 1 — do NOT build the delegate.** The business assistant lives in
agents-agency, which already does it end-to-end (clients, budgets, Gmail
`send_email`, and its own WhatsApp/Telegram channels). Gru's `chat-gateway`
stays focused on dev/engineering orchestration across repos. No `business`
delegate is added to Gru core; Phase 2 is closed as **won't-build** to avoid
duplicating an existing system.

If a single unified chat entry is ever wanted later, revisit Option 2 (thin
pass-through to `/api/ai/chat`).
```
