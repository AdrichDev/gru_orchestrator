import { WhatsAppClient } from "@kapso/whatsapp-cloud-api";
import type { GatewayEnv } from "./env.js";

// WhatsApp text bodies cap near 4096 chars; keep margin for the (n/m) prefix.
const MAX_CHARS = 3500;

/** Outbound WhatsApp sender via Kapso's Meta proxy. Handles fragmentation. */
export class WhatsAppSender {
  private readonly client: WhatsAppClient;
  private readonly phoneNumberId: string;

  constructor(env: GatewayEnv) {
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

/** Split long text on natural boundaries (newline > space > hard cut). */
export function fragment(text: string, max = MAX_CHARS): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = rest.lastIndexOf(" ", max);
    if (cut < max * 0.5) cut = max;
    out.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).replace(/^\s+/, "");
  }
  if (rest.length > 0) out.push(rest);
  return out;
}
