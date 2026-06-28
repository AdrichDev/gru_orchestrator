import { WhatsAppClient } from "@kapso/whatsapp-cloud-api";
import { fragment } from "../../core/fragment.js";
import type { ChannelSender } from "../../core/channel.js";
import type { WhatsAppChannelEnv } from "../../core/env.js";

/** Outbound WhatsApp sender via Kapso's Meta proxy. Handles fragmentation. */
export class WhatsAppSender implements ChannelSender {
  private readonly client: WhatsAppClient;
  private readonly phoneNumberId: string;

  constructor(env: WhatsAppChannelEnv) {
    this.client = new WhatsAppClient({
      baseUrl: env.kapsoBaseUrl,
      kapsoApiKey: env.kapsoApiKey,
    });
    this.phoneNumberId = env.phoneNumberId;
  }

  async send(to: string, body: string): Promise<void> {
    const dest = to.startsWith("+") ? to : `+${to}`;
    const chunks = fragment(body);
    for (let i = 0; i < chunks.length; i++) {
      const prefix = chunks.length > 1 ? `(${i + 1}/${chunks.length})\n` : "";
      await this.client.messages.sendText({
        phoneNumberId: this.phoneNumberId,
        to: dest,
        body: prefix + chunks[i],
      });
    }
  }
}
