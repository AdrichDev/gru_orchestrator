import type { GruIntakeAdapter } from "../../core/intake.js";
import type { TelegramChannelEnv } from "../../core/env.js";
import type { ChannelSender } from "../../core/channel.js";
import { isTelegramAdmin } from "./security.js";
import { transcribeVoice } from "./voice.js";

const API_BASE = "https://api.telegram.org";

interface TgUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number };
    chat?: { id: number };
    text?: string;
    voice?: { file_id?: string };
    audio?: { file_id?: string };
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
    // Sender is used only for voice-transcription status messages; the adapter
    // owns all other replies. Keeps the adapter text-only and channel-agnostic.
    private readonly sender: ChannelSender,
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
          // dispatch is logged here and NOT retried, because re-delivering a
          // directive could double-execute it. At-most-once is the safe choice
          // for an orchestration channel. The .catch also absorbs any failure
          // from the status/error sends inside dispatch (no unhandled rejection).
          this.dispatch(u).catch((err) =>
            console.error("[telegram] dispatch error:", err instanceof Error ? err.message : String(err)),
          );
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
    const userId = msg?.from?.id;
    const chatId = msg?.chat?.id;
    if (!msg || userId === undefined || chatId === undefined) return;

    // Whitelist on the message author, BEFORE any download/transcription work.
    if (!isTelegramAdmin(String(userId), this.env.adminIds)) {
      console.warn(`[telegram] ignored non-whitelisted user: ${userId}`);
      return;
    }

    const chat = String(chatId);
    let text = msg.text;

    // Voice / audio → transcribe locally to text, then treat as a directive.
    if (!text) {
      const fileId = msg.voice?.file_id ?? msg.audio?.file_id;
      if (fileId) {
        try {
          await this.sender.send(chat, "🎙️ Transcribiendo audio...");
          text = await transcribeVoice(this.env.botToken, fileId);
        } catch (err) {
          console.error("[telegram] transcription error:", err);
          await this.sender.send(chat, "❌ No pude transcribir el audio.");
          return;
        }
        if (!text) {
          await this.sender.send(chat, "❌ Audio vacío o no reconocido.");
          return;
        }
        await this.sender.send(chat, `📝 Entendí: "${text}"`);
      }
    }

    // Non-text, non-voice (sticker, photo, …) is ignored in v1.
    if (!text) return;

    try {
      await this.adapter.handle({ from: chat, text, id: String(msg.message_id) });
    } catch (err) {
      console.error("[telegram] handle error:", err);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
