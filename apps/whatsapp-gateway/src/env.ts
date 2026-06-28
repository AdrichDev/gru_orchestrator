import { config as loadDotenv } from "dotenv";
import path from "node:path";

loadDotenv();

export interface GatewayEnv {
  kapsoApiKey: string;
  kapsoBaseUrl: string;
  phoneNumberId: string;
  webhookSecret: string;
  adminNumbers: string[];
  port: number;
  webhookPath: string;
  projectsFile: string;
  defaultProject: string | undefined;
  gruDefaultProvider: string | undefined;
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

export function loadEnv(): GatewayEnv {
  const adminNumbers = required("ADMIN_WHATSAPP_NUMBERS")
    .split(",")
    .map((s) => normalizePhone(s))
    .filter((s) => s.length > 0);

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
    projectsFile: path.resolve(optional("PROJECTS_FILE", "./projects.json")),
    defaultProject: process.env.DEFAULT_PROJECT?.trim() || undefined,
    gruDefaultProvider: process.env.GRU_DEFAULT_PROVIDER?.trim() || undefined,
  };
}
