import type { GruIntakeAdapter } from "../../core/intake.js";
import type { TelegramChannelEnv } from "../../core/env.js";
import { isTelegramAdmin } from "./security.js";

const API_BASE = "https://api.telegram.org";

interface TgUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number };
    chat?: { id: number };
    text?: string;
  };
}

/**
 * Telegram ingress via long-polling (`getUpdates`). Long-polling needs NO public
 * URL / tunnel — it runs fully local, unlike the WhatsApp webhook. Whitelist is
 * enforced on the message author's user id before anything reaches Gru.
 */
export class TelegramIngress {
  private offset = 0;
  private running = false;

  constructor(
    private readonly env: TelegramChannelEnv,
    private readonly adapter: GruIntakeAdapter,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.loop();
  }

  stop(): void {
    this.running = false;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        const updates = await this.getUpdates();
        for (const u of updates) {
          this.offset = u.update_id + 1;
          // Fire-and-forget so a long-running task never blocks polling of new
          // messages (e.g. the "SÍ" approval reply). Offset advances before
          // dispatch completes — deliberate AT-MOST-ONCE semantics: a failed
          // dispatch is logged (see dispatch) and NOT retried, because
          // re-delivering a directive could double-execute it. At-most-once is
          // the safe choice for an orchestration channel.
          void this.dispatch(u);
        }
      } catch (err) {
        console.warn("[telegram] poll error:", err instanceof Error ? err.message : String(err));
        await sleep(3000);
      }
    }
  }

  private async getUpdates(): Promise<TgUpdate[]> {
    const url =
      `${API_BASE}/bot${this.env.botToken}/getUpdates` +
      `?timeout=${this.env.pollTimeoutSec}&offset=${this.offset}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`getUpdates ${res.status}`);
    const data = (await res.json()) as { ok: boolean; result?: TgUpdate[] };
    return data.result ?? [];
  }

  private async dispatch(u: TgUpdate): Promise<void> {
    const msg = u.message;
    const text = msg?.text;
    const userId = msg?.from?.id;
    const chatId = msg?.chat?.id;
    if (!msg || !text || userId === undefined || chatId === undefined) return;

    if (!isTelegramAdmin(String(userId), this.env.adminIds)) {
      console.warn(`[telegram] ignored non-whitelisted user: ${userId}`);
      return;
    }

    try {
      await this.adapter.handle({ from: String(chatId), text, id: String(msg.message_id) });
    } catch (err) {
      console.error("[telegram] handle error:", err);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
