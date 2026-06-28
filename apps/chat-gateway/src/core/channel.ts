/** Channel-agnostic contracts shared by every chat adapter (WhatsApp, Telegram…). */

export interface ChannelSender {
  /** Send a text reply to `to` (a channel-specific address: phone / chat id). */
  send(to: string, body: string): Promise<void>;
}

export interface InboundMessage {
  /** Reply address for this sender (phone digits / Telegram chat id). */
  from: string;
  text: string;
  id: string;
}

export type ChannelId = "whatsapp" | "telegram";
