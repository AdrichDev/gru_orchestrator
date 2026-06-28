# @gru/whatsapp-gateway

Thin **WhatsApp → Gru** channel adapter. Send a message on WhatsApp, Gru routes /
classifies risk / escalates / executes, and the result comes back to your chat.

WhatsApp is **only an I/O channel**. All routing, risk classification and
escalation stay inside Gru (`orchestrateTask`). This package never duplicates any
of that logic.

```
WhatsApp (Kapso webhook)
        │  POST /webhooks/whatsapp  (HMAC verified, whitelisted)
        ▼
  server.ts ──normalizeWebhook──▶ intake.ts (GruIntakeAdapter)
        │                               │
        │                     single-flight queue + chdir(project)
        │                               ▼
        │                     orchestrateTask(prompt, provider?, {approved?})
        │                               │  (kernel: Router → Risk → Devil → provider)
        ▼                               ▼
  WhatsApp reply  ◀────────────  result / error / approval request
```

## What it does (v1)

- Receives WhatsApp messages via **Kapso** webhooks (no Twilio / Meta BSP).
- **Whitelist**: only configured admin numbers can inject tasks.
- **Signature verification**: HMAC-SHA256 over the raw body (`X-Webhook-Signature`).
- **Adaptive multi-project**: `/proyecto <NAME>` switches the active repo; each
  directive runs with the process CWD pointed at that repo.
- **Two-shot replies**: an immediate "recibí la directiva…" ack, then the final
  result. (Gru emits no intermediate progress events — see *Limitations*.)
- **Risk approval flow**: when Gru returns `HumanApprovalRequiredError`, you get a
  `"responde SÍ"` prompt. Destructive/irreversible tasks require a **second**
  `CONFIRMO`.
- **No silent fallback**: Gru's exact error (provider unavailable, Devil's
  Advocate block, build/review failure) is forwarded verbatim.
- **Audit trail**: every event is appended to `<project>/.gru/whatsapp-channel.log`.

## Not in v1 (explicitly out of scope)

- **Business-assistant actions** ("genera presupuesto → valida → manda por mail").
  Per Gru's own rule, sending email / generating PDFs are **capabilities** that
  belong in a Gru Minion/provider or in your 3A_Estudio app's API — **not** in the
  WhatsApp layer. This gateway would only relay such a directive; the capability
  must exist in Gru first. Tracked as **Phase 2**.
- Intermediate progress streaming (needs event emitters in the kernel core —
  requires a separate change to `orchestrateTask`).
- Media / interactive WhatsApp messages (text only for now).

## Prerequisites

- Node ≥ 20, `pnpm` (this is a workspace package of `gru_orchestrator`).
- A Kapso account + a connected WhatsApp number.
- A tunnel to expose your local port publicly (`cloudflared` or `ngrok`).

## Setup from zero

### 1. Install workspace deps

From the repo root:

```bash
pnpm install
```

### 2. Kapso: log in and connect a number

```bash
npm install -g @kapso/cli
kapso login          # opens browser; creds stored in ~/.kapso/cli
kapso setup          # connect / register your WhatsApp number
```

Note the **phone number id** Kapso assigns — you'll need it below.

### 3. Configure the gateway

```bash
cd apps/whatsapp-gateway
cp env.example .env
cp projects.example.json projects.json
```

Edit `.env`:

| Var | Meaning |
|-----|---------|
| `KAPSO_API_KEY` | Project API key from Kapso. |
| `KAPSO_PHONE_NUMBER_ID` | Id of the connected number. |
| `KAPSO_WEBHOOK_SECRET` | Secret Kapso signs deliveries with. |
| `ADMIN_WHATSAPP_NUMBERS` | Your number(s), digits + country code, no `+`. |
| `DEFAULT_PROJECT` | Project used before any `/proyecto`. |
| `GRU_DEFAULT_PROVIDER` | Optional; leave empty to let the Router decide. |

Edit `projects.json` — map each project name to its **absolute** repo path:

```json
{
  "3A_ESTUDIO": { "path": "D:/Adrian/Projects/3A_Estudio" },
  "GRU": { "path": "D:/Adrian/10. IA/Gru-Orchestrator" }
}
```

### 4. Start the gateway

```bash
pnpm start          # or: pnpm dev   (watch mode)
```

It prints the listening port and the configured projects.

### 5. Expose the port and register the webhook

In a second terminal:

```bash
cloudflared tunnel --url http://localhost:8787
# → gives you https://<random>.trycloudflare.com
```

Register that public URL with Kapso (path must match `WEBHOOK_PATH`):

```bash
kapso whatsapp webhooks new \
  --phone-number-id <id> \
  --url "https://<random>.trycloudflare.com/webhooks/whatsapp" \
  --event whatsapp.message.received \
  --active
```

> The `KAPSO_WEBHOOK_SECRET` in `.env` must equal the secret Kapso uses to sign
> deliveries, or every webhook is rejected with `401 invalid signature`.

### 6. Use it

From your whitelisted WhatsApp number:

```
/proyectos                          → list projects
/proyecto 3A_ESTUDIO                → set active project
Crea un endpoint Express para registrar empleados
        → 🤖 recibí la directiva… → ✅ resultado
```

When Gru flags risk:

```
⚠️ Riesgo nivel 3 — Large. Motivos: toca seguridad o auth.
Responde SÍ para ejecutar, o NO para cancelar.
SÍ
▶️ Ejecutando (aprobado)… → ✅ resultado
```

Destructive task → `SÍ` then `CONFIRMO`.

## Health check

```bash
curl http://localhost:8787/health   # {"ok":true}
```

## Limitations / verify-before-trust

- **Webhook payload shape** is read via the Kapso SDK `normalizeWebhook()`
  (`id`, `from`, `text.body`, `type`, `kapso.direction`). If a future SDK version
  renames fields, adjust `server.ts`.
- **Signature scheme**: this verifies HMAC-SHA256 over the **raw** body. If your
  Kapso project signs a re-serialized JSON instead, adjust `security.ts`
  (documented inline).
- **CWD switching** uses `process.chdir()`, which is global — hence the
  single-flight queue. One task runs at a time by design.

## Engram integration (Phase 2 seam)

`engram-log.ts` currently writes a local JSONL audit trail tagged
`channel: "whatsapp"`. Wiring these events into Engram (`mem_save`) is left as an
explicit seam rather than faked, because the kernel's `EngramProvider` is
MCP-backed. See `traceChannelEvent`.
