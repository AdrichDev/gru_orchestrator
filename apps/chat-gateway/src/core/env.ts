import { config as loadDotenv } from "dotenv";
import path from "node:path";
import type { ChannelId } from "./channel.js";

loadDotenv();

export interface WhatsAppChannelEnv {
  kapsoApiKey: string;
  kapsoBaseUrl: string;
  phoneNumberId: string;
  webhookSecret: string;
  adminNumbers: string[];
  port: number;
  webhookPath: string;
}

export interface TelegramChannelEnv {
  botToken: string;
  adminIds: string[];
  pollTimeoutSec: number;
}

export interface GatewayEnv {
  /** Channels to start this run. */
  channels: ChannelId[];
  // Shared, channel-agnostic config consumed by the intake core.
  projectsFile: string;
  defaultProject: string | undefined;
  gruDefaultProvider: string | undefined;
  /** After this many ms a still-running task triggers a "still working" notice. 0 = off. */
  taskTimeoutMs: number;
  // Per-channel config, present only when that channel is enabled.
  whatsapp?: WhatsAppChannelEnv;
  telegram?: TelegramChannelEnv;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required env var: ${name}. See env.example.`);
  }
  return v.trim();
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : fallback;
}

function parsePort(raw: string): number {
  const port = Number.parseInt(raw, 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: "${raw}". Must be an integer in 1..65535.`);
  }
  return port;
}

/** Reduce any phone string to its digits, so "+34 600..." and "34600..." match. */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

function parseList(raw: string, map: (s: string) => string = (s) => s.trim()): string[] {
  return raw.split(",").map(map).filter((s) => s.length > 0);
}

function loadWhatsApp(): WhatsAppChannelEnv {
  const adminNumbers = parseList(required("ADMIN_WHATSAPP_NUMBERS"), normalizePhone);
  if (adminNumbers.length === 0) {
    throw new Error("ADMIN_WHATSAPP_NUMBERS must contain at least one number.");
  }
  return {
    kapsoApiKey: required("KAPSO_API_KEY"),
    kapsoBaseUrl: optional("KAPSO_BASE_URL", "https://api.kapso.ai/meta/whatsapp"),
    phoneNumberId: required("KAPSO_PHONE_NUMBER_ID"),
    webhookSecret: required("KAPSO_WEBHOOK_SECRET"),
    adminNumbers,
    port: parsePort(optional("PORT", "8787")),
    webhookPath: optional("WEBHOOK_PATH", "/webhooks/whatsapp"),
  };
}

function loadTelegram(): TelegramChannelEnv {
  const adminIds = parseList(required("TELEGRAM_ADMIN_IDS"));
  if (adminIds.length === 0) {
    throw new Error("TELEGRAM_ADMIN_IDS must contain at least one numeric user id.");
  }
  const pollTimeoutSec = Number.parseInt(optional("TELEGRAM_POLL_TIMEOUT", "30"), 10);
  return {
    botToken: required("TELEGRAM_BOT_TOKEN"),
    adminIds,
    // Telegram caps long-poll timeout near 50s; clamp to a safe 1..50 range.
    pollTimeoutSec: Number.isNaN(pollTimeoutSec) ? 30 : Math.min(50, Math.max(1, pollTimeoutSec)),
  };
}

export function loadEnv(): GatewayEnv {
  const channels = parseList(optional("CHANNELS", "whatsapp").toLowerCase()) as ChannelId[];
  const valid: ChannelId[] = ["whatsapp", "telegram"];
  const unknown = channels.filter((c) => !valid.includes(c));
  if (unknown.length > 0) {
    throw new Error(`Unknown CHANNELS value(s): ${unknown.join(", ")}. Valid: ${valid.join(", ")}.`);
  }
  if (channels.length === 0) {
    throw new Error("CHANNELS must enable at least one channel (whatsapp, telegram).");
  }

  const timeoutMin = Number.parseInt(optional("GRU_TASK_TIMEOUT_MIN", "5"), 10);
  const taskTimeoutMs = (Number.isNaN(timeoutMin) ? 5 : Math.max(0, timeoutMin)) * 60_000;

  return {
    channels,
    projectsFile: path.resolve(optional("PROJECTS_FILE", "./projects.json")),
    defaultProject: process.env.DEFAULT_PROJECT?.trim() || undefined,
    gruDefaultProvider: process.env.GRU_DEFAULT_PROVIDER?.trim() || undefined,
    taskTimeoutMs,
    whatsapp: channels.includes("whatsapp") ? loadWhatsApp() : undefined,
    telegram: channels.includes("telegram") ? loadTelegram() : undefined,
  };
}
