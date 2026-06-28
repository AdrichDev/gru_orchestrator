import express, { type Request, type Response } from "express";
import { normalizeWebhook } from "@kapso/whatsapp-cloud-api/server";
import { normalizePhone, type GatewayEnv } from "./env.js";
import { verifyKapsoSignature, isWhitelisted } from "./security.js";
import type { GruIntakeAdapter, InboundMessage } from "./intake.js";

// The exact normalized message type lives in the Kapso SDK; we read it
// defensively (only the documented fields: id, from, text.body, type, kapso).
interface NormalizedMessage {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  kapso?: { direction?: "inbound" | "outbound" };
}

export function createServer(env: GatewayEnv, adapter: GruIntakeAdapter) {
  const app = express();

  // Raw body is REQUIRED for HMAC signature verification — register it only on
  // the webhook path so the rest of the app can use normal parsers if needed.
  app.use(env.webhookPath, express.raw({ type: "*/*", limit: "2mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.post(env.webhookPath, (req: Request, res: Response) => {
    const raw = req.body as Buffer;
    const signature = req.header("X-Webhook-Signature");

    if (!verifyKapsoSignature(raw, signature, env.webhookSecret)) {
      console.warn("[webhook] invalid signature — rejected");
      res.status(401).json({ error: "invalid signature" });
      return;
    }

    // Ack immediately; process asynchronously (two-shot model, never block Kapso).
    res.status(200).json({ received: true });

    let payload: unknown;
    try {
      payload = JSON.parse(raw.toString("utf-8"));
    } catch {
      console.warn("[webhook] body is not valid JSON");
      return;
    }

    let messages: NormalizedMessage[];
    try {
      const events = normalizeWebhook(payload) as { messages?: NormalizedMessage[] };
      messages = events.messages ?? [];
    } catch (err) {
      console.warn("[webhook] normalize failed:", err instanceof Error ? err.message : String(err));
      return;
    }

    for (const message of messages) {
      if (message?.kapso?.direction === "outbound") continue;
      if (message?.type !== "text") continue; // v1: text only.

      const from = normalizePhone(String(message.from ?? ""));
      const text = String(message.text?.body ?? "");
      const id = String(message.id ?? "");
      if (!from || !text) continue;

      if (!isWhitelisted(from, env.adminNumbers)) {
        console.warn(`[webhook] ignored non-whitelisted sender: ${from}`);
        continue;
      }

      const inbound: InboundMessage = { from, text, id };
      adapter
        .handle(inbound)
        .catch((err) => console.error("[adapter] handle error:", err));
    }
  });

  return app;
}
