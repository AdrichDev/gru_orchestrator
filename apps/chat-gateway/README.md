# @gru/chat-gateway — Gru chat gateway

Thin **chat → Gru** gateway. Send a message on **WhatsApp** or **Telegram**, Gru
routes / classifies risk / escalates / executes, and the result comes back to
your chat.

Chat is **only an I/O channel**. All routing, risk classification and escalation
stay inside Gru (`orchestrateTask`). This package never duplicates any of that.

```
WhatsApp (Kapso webhook)  ─┐
Telegram (long-poll)      ─┤  whitelist + (WhatsApp: HMAC verify)
                           ▼
                  GruIntakeAdapter (per channel)
                           │   shared single-flight queue + chdir(project)
                           ▼
            orchestrateTask(prompt, provider?, {approved?})
                           │  (kernel: Router → Risk → Devil → provider)
                           ▼
                  reply back to the originating chat
```

## Channels

| Channel | Ingress | Public URL / tunnel | Meta / business account |
|---------|---------|---------------------|-------------------------|
| WhatsApp (Kapso) | webhook | **required** (cloudflared/ngrok) | yes — WABA via Kapso, verification for production |
| Telegram | long-poll (`getUpdates`) | **not needed** (fully local) | no — free Bot API, no ban risk |

Enable either or both via `CHANNELS=whatsapp,telegram`.

> Both channels share ONE single-flight queue: tasks run one at a time, because
> `orchestrateTask` switches the process CWD per project. WhatsApp and Telegram
> tasks never run concurrently.

## What it does (v1)

- **Whitelist**: WhatsApp by phone number, Telegram by numeric user id. Only
  configured admins can inject tasks.
- **WhatsApp signature**: HMAC-SHA256 over the raw body (`X-Webhook-Signature`).
- **Adaptive multi-project**: `/proyecto <NAME>` switches the active repo; each
  directive runs with the CWD pointed at that repo.
- **Two-shot replies**: immediate "recibí la directiva…" ack, then the final
  result. (Gru emits no intermediate progress — see *Limitations*.)
- **Risk approval**: `HumanApprovalRequiredError` → `"responde SÍ"`; destructive
  tasks require a **second** `CONFIRMO`.
- **No silent fallback**: Gru's exact error is forwarded verbatim.
- **Audit trail**: events appended to `<project>/.gru/chat-channel.log`.

## Not in v1 (out of scope)

- **Business-assistant actions** ("genera presupuesto → valida → manda por mail").
  See `docs/PHASE2-business-assistant.md` — those are Gru capabilities, not a
  channel concern.
- Intermediate progress streaming, media/interactive messages (text only).

## Layout

```
src/
  core/        channel-agnostic: intake, queue, sessions, projects, env, fragment
  channels/
    whatsapp/  Kapso webhook server + sender + signature
    telegram/  long-poll ingress + sender + whitelist
  index.ts     composition root (shared queue, per-channel adapters)
```

## Setup from zero

### 1. Install workspace deps (from repo root)

```bash
pnpm install
```

### 2. Configure

```bash
cd apps/chat-gateway
cp env.example .env
cp projects.example.json projects.json
```

Set `CHANNELS` to what you want, fill the matching section(s), and edit
`projects.json` with **absolute** repo paths:

```json
{
  "3A_ESTUDIO": { "path": "D:/Adrian/Projects/3A_Estudio" },
  "GRU": { "path": "D:/Adrian/10. IA/Gru-Orchestrator" }
}
```

### 3a. WhatsApp channel (Kapso)

```bash
npm install -g @kapso/cli
kapso login          # browser auth, creds in ~/.kapso/cli
kapso setup          # connect/register your WhatsApp number
```

Note the **phone number id**. Set `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`,
`KAPSO_WEBHOOK_SECRET`, `ADMIN_WHATSAPP_NUMBERS` in `.env`.

> WhatsApp goes through Meta: Kapso creates the Meta Business Portfolio + WABA in
> the embedded signup (only a Facebook account is the hard requirement).
> Connecting the number does NOT bypass Meta — display-name/business
> verification, WABA review and template review still gate **production** sending.
> A personal bot can start within test-tier limits.

### 3b. Telegram channel

1. Message **@BotFather** → `/newbot` → copy the bot token → `TELEGRAM_BOT_TOKEN`.
2. Message **@userinfobot** from your account → copy your numeric id →
   `TELEGRAM_ADMIN_IDS`.

No tunnel, no Meta, no verification. Free.

### 4. Start

```bash
pnpm start          # or: pnpm dev (watch)
```

Telegram starts polling immediately. For WhatsApp, expose the port and register
the webhook:

```bash
cloudflared tunnel --url http://localhost:8787
kapso whatsapp webhooks new \
  --phone-number-id <id> \
  --url "https://<random>.trycloudflare.com/webhooks/whatsapp" \
  --event whatsapp.message.received \
  --active
```

> `KAPSO_WEBHOOK_SECRET` must equal the secret Kapso signs with, or every webhook
> is rejected with `401 invalid signature`.

### 5. Use it

```
/proyectos                          → list projects
/proyecto 3A_ESTUDIO                → set active project
Crea un endpoint Express para registrar empleados
        → 🤖 recibí la directiva… → ✅ resultado
```

Risk:
```
⚠️ Riesgo nivel 3 — Large. Motivos: toca seguridad o auth.
Responde SÍ para ejecutar, o NO para cancelar.   → SÍ
```
Destructive task → `SÍ` then `CONFIRMO`.

## Limitations / verify-before-trust

- WhatsApp payload read via Kapso SDK `normalizeWebhook()`; signature is HMAC over
  the **raw** body. If your project signs re-serialized JSON, adjust
  `channels/whatsapp/security.ts` (documented inline).
- Telegram uses the official Bot API (`getUpdates` / `sendMessage`). Ref:
  https://core.telegram.org/bots/api
- CWD switching uses `process.chdir()` (global) — hence the shared single-flight
  queue. One task runs at a time by design.

## Engram integration (Phase 2 seam)

`core/engram-log.ts` writes a local JSONL audit trail tagged with the channel.
Wiring these into Engram (`mem_save`) is an explicit seam (kernel EngramProvider
is MCP-backed), not faked. See `traceChannelEvent`.
```
