import { fragment } from "../../core/fragment.js";
import type { ChannelSender } from "../../core/channel.js";

const API_BASE = "https://api.telegram.org";
// Telegram text messages cap at 4096 chars.
const TELEGRAM_MAX = 4000;

/** Outbound Telegram sender via the official Bot API (no SDK; uses global fetch). */
export class TelegramSender implements ChannelSender {
  constructor(private readonly token: string) {}

  async send(to: string, body: string): Promise<void> {
    const chunks = fragment(body, TELEGRAM_MAX);
    for (let i = 0; i < chunks.length; i++) {
      const prefix = chunks.length > 1 ? `(${i + 1}/${chunks.length})\n` : "";
      const res = await fetch(`${API_BASE}/bot${this.token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: to, text: prefix + chunks[i] }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Telegram sendMessage failed (${res.status}): ${detail}`);
      }
    }
  }
}
